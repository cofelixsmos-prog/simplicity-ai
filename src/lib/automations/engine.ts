// The automation engine: turns a natural-language request into a workflow +
// permission plan, and processes one "tick" for a running automation — polling
// Gmail, letting the LLM decide per email, and taking the granted actions.
//
// This runs SERVER-SIDE (from the background scheduler and the create API), so
// it works whether or not the user's browser is open.

import type { Automation, User } from "@/lib/db/schema"
import { getUserById, addAutomationEvent, patchAutomationState } from "@/lib/db/repo"
import { listMessages, modifyMessages, trashMessages, getAttachments, type InboxItem } from "@/lib/imap"
import { getGmailTransport, sendVia, EMAIL_RE } from "@/lib/email"
import { uploadDriveBinary } from "@/lib/drive"

const ZEN_URL = "https://opencode.ai/zen/v1/chat/completions"
const MODEL = "deepseek-v4-flash-free"

// ── Types ────────────────────────────────────────────────────────────────────
export interface AutomationPlan {
  name: string
  workflow: string[]
  services: string[]
  permissions: Record<string, Record<string, boolean>>
  config: { approvalMode: boolean; rateLimitPerHour: number; digestHour: number | null }
}

interface WorkerState {
  lastUid?: number
  sent?: number[] // reply timestamps, for rate limiting
  started?: boolean
  lastDigestDay?: string // YYYY-MM-DD of the last digest sent
}

interface AutoStats {
  emailsRead?: number
  repliesSent?: number
  filesSaved?: number
  archived?: number
  flagged?: number
  digests?: number
}

// ── LLM helper ───────────────────────────────────────────────────────────────
async function callLLM(messages: { role: string; content: string }[], maxTokens = 1024): Promise<string> {
  const apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) return ""
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 45_000)
  try {
    const r = await fetch(ZEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, stream: false, temperature: 0.4, max_tokens: maxTokens, messages }),
      signal: ctrl.signal,
    })
    if (!r.ok) return ""
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    return j?.choices?.[0]?.message?.content ?? ""
  } catch {
    return ""
  } finally {
    clearTimeout(to)
  }
}

function extractJson(raw: string): Record<string, unknown> | null {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*/gi, "")
  t = t.replace(/```(?:json)?/gi, "").trim()
  const m = t.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

// ── Planner: natural language → workflow + permissions ───────────────────────
const PLAN_SYSTEM = `You convert a user's request into an automation plan for a 24/7 background agent that can watch Gmail and Google Drive. Reply with ONLY JSON, no prose, no markdown, no thinking.

{"name":"Short name","workflow":["Watch Gmail","New email","Read email","Generate reply","Send reply"],"services":["gmail"],"permissions":{"gmail":{"read":true,"reply":true,"archive":false,"trash":false},"drive":{"read":false,"save":false}},"config":{"approvalMode":false,"rateLimitPerHour":20,"digestHour":null}}

Rules:
- name: 2-4 words describing the job (e.g. "Inbox Assistant", "Drive Organizer", "Morning Digest").
- workflow: 3-6 short human-readable steps showing the flow.
- services: subset of ["gmail","drive"] actually needed. Saving attachments to Drive needs both "gmail" and "drive".
- permissions: ONLY set true the ones the task truly requires (least privilege). gmail actions: read, reply, archive, trash. drive actions: read, save. To save email attachments to Drive, set gmail.read + drive.save true.
- config.approvalMode: true if the task is destructive or sensitive (deleting, sending on the user's behalf to many people). Default false for read/summarize.
- config.rateLimitPerHour: a sensible cap on outbound actions (10-40).
- config.digestHour: for SCHEDULED SUMMARY / DIGEST tasks (e.g. "summarize my inbox every morning"), set this to the hour of day 0-23 to send it (morning = 8). For these, set gmail.read true and reply/archive false. For all other (event-driven) tasks set digestHour to null.
Reply with JSON only.`

export async function planAutomation(prompt: string): Promise<AutomationPlan> {
  const raw = await callLLM(
    [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: prompt },
    ],
    900
  )
  const parsed = extractJson(raw)
  if (parsed && typeof parsed.name === "string" && Array.isArray(parsed.workflow)) {
    const perms = (parsed.permissions ?? {}) as Record<string, Record<string, boolean>>
    return {
      name: String(parsed.name).slice(0, 60),
      workflow: (parsed.workflow as unknown[]).map(String).slice(0, 6),
      services: Array.isArray(parsed.services) ? (parsed.services as unknown[]).map(String) : ["gmail"],
      permissions: {
        gmail: {
          read: !!perms.gmail?.read,
          reply: !!perms.gmail?.reply,
          archive: !!perms.gmail?.archive,
          trash: !!perms.gmail?.trash,
        },
        drive: { read: !!perms.drive?.read, save: !!perms.drive?.save },
      },
      config: {
        approvalMode: !!(parsed.config as Record<string, unknown>)?.approvalMode,
        rateLimitPerHour: Number((parsed.config as Record<string, unknown>)?.rateLimitPerHour) || 20,
        digestHour: digestHourOf((parsed.config as Record<string, unknown>)?.digestHour),
      },
    }
  }
  // Heuristic fallback so creation never dead-ends.
  return heuristicPlan(prompt)
}

function digestHourOf(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null
}

function heuristicPlan(prompt: string): AutomationPlan {
  const p = prompt.toLowerCase()
  const reply = /repl(y|ies)|respond|answer/.test(p)
  const archive = /archive|clean|promotional|newsletter/.test(p)
  const trash = /delete|trash|remove/.test(p)
  const drive = /drive|save|file|attachment|pdf/.test(p)
  const summarize = /summar|digest|overview|brief/.test(p)
  const workflow = ["Watch Gmail", "New email arrives", "Read email"]
  if (summarize) workflow.push("Summarize")
  if (reply) workflow.push("Generate reply", "Send reply")
  if (archive) workflow.push("Archive if promotional")
  if (drive) workflow.push("Save attachment to Drive")
  return {
    name: reply ? "Inbox Assistant" : drive ? "Drive Saver" : summarize ? "Morning Digest" : "Gmail Watcher",
    workflow,
    services: drive ? ["gmail", "drive"] : ["gmail"],
    permissions: {
      gmail: { read: true, reply, archive, trash },
      drive: { read: drive, save: drive },
    },
    config: { approvalMode: trash, rateLimitPerHour: 20, digestHour: summarize ? 8 : null },
  }
}

// ── Per-email decision ───────────────────────────────────────────────────────
interface EmailDecision {
  action: "reply" | "archive" | "skip"
  reason: string
  subject?: string
  body?: string
}

async function decideOnEmail(auto: Automation, perms: Record<string, Record<string, boolean>>, email: InboxItem): Promise<EmailDecision> {
  const allowed: string[] = []
  if (perms.gmail?.reply) allowed.push("reply")
  if (perms.gmail?.archive) allowed.push("archive")
  allowed.push("skip")

  const sys = `You are a background email assistant. The user's standing instruction is:
"${auto.prompt}"

Decide what to do with ONE incoming email. Allowed actions: ${allowed.join(", ")}.
Reply with ONLY JSON:
{"action":"reply|archive|skip","reason":"short why","subject":"Re: ...","body":"the reply text"}
- Only include subject/body when action is "reply". Write a professional, concise reply that fits the user's instruction. Sign off politely.
- Use "skip" for no-reply/automated/promotional senders unless the instruction clearly wants otherwise.
Reply with JSON only, no thinking.`

  const user = `From: ${email.from}
Subject: ${email.subject}
Body:
${(email.body || email.snippet || "").slice(0, 2500)}`

  const raw = await callLLM([{ role: "system", content: sys }, { role: "user", content: user }], 900)
  const parsed = extractJson(raw)
  const action = String(parsed?.action ?? "skip")
  if (action === "reply" && perms.gmail?.reply) {
    return {
      action: "reply",
      reason: String(parsed?.reason ?? "Replying"),
      subject: String(parsed?.subject ?? `Re: ${email.subject}`),
      body: String(parsed?.body ?? ""),
    }
  }
  if (action === "archive" && perms.gmail?.archive) {
    return { action: "archive", reason: String(parsed?.reason ?? "Archiving") }
  }
  return { action: "skip", reason: String(parsed?.reason ?? "No action needed") }
}

// Extract a bare email address from a "Name <email>" string.
function bareEmail(from: string): string | null {
  const angle = from.match(/<([^>]+)>/)
  const candidate = (angle ? angle[1] : from).trim()
  return EMAIL_RE.test(candidate) ? candidate : null
}

function withinRate(state: WorkerState, limit: number): boolean {
  const hourAgo = Date.now() - 3_600_000
  const recent = (state.sent ?? []).filter((t) => t > hourAgo)
  return recent.length < limit
}

// ── One processing tick for a single automation ──────────────────────────────
export async function runTick(auto: Automation): Promise<{ actions: number; note?: string }> {
  const user: User | undefined = await getUserById(auto.userId)
  if (!user) return { actions: 0, note: "no user" }

  const perms = JSON.parse(auto.permissions || "{}") as Record<string, Record<string, boolean>>
  const cfg = JSON.parse(auto.config || "{}") as { approvalMode?: boolean; rateLimitPerHour?: number; digestHour?: number | null }
  const state = JSON.parse(auto.state || "{}") as WorkerState
  const stats = JSON.parse(auto.stats || "{}") as AutoStats
  const hasGmail = !!(user.gmailAppPassword || user.gmailRefreshToken)
  const services = (() => { try { return JSON.parse(auto.services || "[]") as string[] } catch { return [] } })()

  // Gmail is the only event source in v1.
  if (!services.includes("gmail")) {
    await patchAutomationState(auto.id, { lastRunAt: Date.now() })
    return { actions: 0 }
  }
  if (!hasGmail) {
    await patchAutomationState(auto.id, { lastRunAt: Date.now() })
    await addAutomationEvent({
      automationId: auto.id, userId: auto.userId, kind: "system",
      title: "Gmail isn't connected — nothing to watch. Connect Gmail in Settings.", status: "error",
    })
    return { actions: 0, note: "no gmail" }
  }

  // ── Scheduled digest mode ──────────────────────────────────────────────────
  if (typeof cfg.digestHour === "number") {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    if (state.lastDigestDay === today || now.getHours() < cfg.digestHour) {
      await patchAutomationState(auto.id, { lastRunAt: Date.now() })
      return { actions: 0 }
    }
    let items: InboxItem[]
    try {
      items = await listMessages(user, { mailbox: "INBOX", limit: 25, full: true })
    } catch {
      await patchAutomationState(auto.id, { lastRunAt: Date.now() })
      return { actions: 0, note: "imap error" }
    }
    const listing = items
      .map((e) => `- ${e.seen ? "" : "[unread] "}From ${e.from} — ${e.subject}: ${(e.snippet || "").slice(0, 140)}`)
      .join("\n")
    const summary = (await callLLM([
      { role: "system", content: `You write a short, scannable morning inbox digest for the user based on their standing instruction: "${auto.prompt}". Group by importance, note who needs a response, and keep it under 200 words. Plain text, no markdown headers.` },
      { role: "user", content: `Here are the latest inbox emails:\n${listing || "(inbox empty)"}\n\nWrite the digest.` },
    ], 700)).replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*/gi, "").trim() || "Your inbox is quiet — nothing notable."

    const to = (user.gmailAddress || user.email).trim()
    const t = getGmailTransport(user)
    let sent = false
    if (t && to) {
      const res = await sendVia(t.transport, t.from, { to, subject: `Your inbox digest — ${today}`, body: summary })
      sent = res.ok
    }
    state.lastDigestDay = today
    stats.digests = (stats.digests ?? 0) + 1
    await patchAutomationState(auto.id, { state: JSON.stringify(state), stats: JSON.stringify(stats), lastRunAt: Date.now(), lastActionAt: Date.now() })
    await addAutomationEvent({
      automationId: auto.id, userId: auto.userId, kind: "system",
      title: sent ? `Sent your inbox digest to ${to}` : "Prepared your inbox digest",
      detail: { steps: ["Read inbox", "Summarized", sent ? "Emailed digest" : "Ready"], result: summary.slice(0, 800) },
      status: "success",
    })
    return { actions: 1 }
  }

  let inbox: InboxItem[]
  try {
    inbox = await listMessages(user, { mailbox: "INBOX", limit: 12, full: true })
  } catch {
    await patchAutomationState(auto.id, { lastRunAt: Date.now() })
    return { actions: 0, note: "imap error" }
  }

  const maxUid = inbox.reduce((m, e) => Math.max(m, e.uid), 0)

  // First run: seal the baseline so we only act on mail that arrives AFTER
  // activation — never blast replies at the entire existing inbox.
  if (!state.started) {
    state.started = true
    state.lastUid = maxUid
    state.sent = []
    await patchAutomationState(auto.id, { state: JSON.stringify(state), lastRunAt: Date.now() })
    await addAutomationEvent({
      automationId: auto.id, userId: auto.userId, kind: "system",
      title: "Started watching Gmail — will act on new mail from now on.", status: "success",
    })
    return { actions: 0 }
  }

  const lastUid = state.lastUid ?? 0
  // New mail since last tick, oldest → newest, capped per tick.
  const fresh = inbox.filter((e) => e.uid > lastUid).sort((a, b) => a.uid - b.uid).slice(0, 5)

  let actions = 0
  const rate = cfg.rateLimitPerHour ?? 20
  const approval = !!cfg.approvalMode

  for (const email of fresh) {
    stats.emailsRead = (stats.emailsRead ?? 0) + 1
    const from = bareEmail(email.from)

    // Save attachments to Drive (independent of the reply decision).
    if (perms.drive?.save) {
      try {
        const atts = await getAttachments(user, email.uid)
        for (const a of atts.slice(0, 5)) {
          const up = await uploadDriveBinary(user, a.filename, a.content, a.contentType)
          if (!("error" in up)) {
            stats.filesSaved = (stats.filesSaved ?? 0) + 1
            actions++
            await addAutomationEvent({
              automationId: auto.id, userId: auto.userId, kind: "file",
              title: `Saved ${a.filename} to Drive`,
              detail: { steps: ["Email received", "Found attachment", "Saved to Drive"], reason: `From ${email.from}` },
              status: "success",
            })
          } else {
            await addAutomationEvent({
              automationId: auto.id, userId: auto.userId, kind: "file",
              title: `Couldn't save ${a.filename}`, detail: { error: up.error }, status: "error",
            })
          }
        }
      } catch {
        /* attachment fetch/upload failed — skip */
      }
    }

    // Only spend an LLM decision when the automation can actually reply/archive.
    const canDecide = !!(perms.gmail?.reply || perms.gmail?.archive)
    let decision: EmailDecision = { action: "skip", reason: "" }
    if (canDecide) {
      try {
        decision = await decideOnEmail(auto, perms, email)
      } catch {
        decision = { action: "skip", reason: "decision failed" }
      }
    }

    if (decision.action === "reply" && from && decision.body) {
      if (!withinRate(state, rate)) {
        await addAutomationEvent({
          automationId: auto.id, userId: auto.userId, kind: "reply",
          title: `Rate limit reached — held reply to ${from}`,
          detail: { decision: decision.reason }, status: "skipped",
        })
        continue
      }
      if (approval) {
        await addAutomationEvent({
          automationId: auto.id, userId: auto.userId, kind: "reply",
          title: `Reply ready for approval — to ${from}`,
          detail: { steps: ["Email received", "Read email", "Generated reply"], to: from, subject: decision.subject, body: decision.body, from: email.from, reason: decision.reason },
          status: "pending",
        })
        actions++
        continue
      }
      const t = getGmailTransport(user)
      if (t) {
        const res = await sendVia(t.transport, t.from, { to: from, subject: decision.subject || `Re: ${email.subject}`, body: decision.body })
        if (res.ok) {
          stats.repliesSent = (stats.repliesSent ?? 0) + 1
          state.sent = [...(state.sent ?? []).filter((x) => x > Date.now() - 3_600_000), Date.now()]
          actions++
          await addAutomationEvent({
            automationId: auto.id, userId: auto.userId, kind: "reply",
            title: `Replied to ${from}`,
            detail: { steps: ["Email received", "Read email", "Generated reply", "Reply sent"], subject: decision.subject, reason: decision.reason },
            status: "success",
          })
        } else {
          await addAutomationEvent({
            automationId: auto.id, userId: auto.userId, kind: "reply",
            title: `Couldn't reply to ${from}`, detail: { error: res.error }, status: "error",
          })
        }
      }
    } else if (decision.action === "archive") {
      try {
        await modifyMessages(user, [email.uid], "archive")
        stats.archived = (stats.archived ?? 0) + 1
        actions++
        await addAutomationEvent({
          automationId: auto.id, userId: auto.userId, kind: "email",
          title: `Archived: ${email.subject}`, detail: { steps: ["Email received", "Read email", "Archived"], reason: decision.reason }, status: "success",
        })
      } catch {
        /* ignore archive failure */
      }
    } else if (canDecide) {
      // Read but chose not to act — only log this when acting was possible, so
      // Drive-only automations don't spam a "Read" line per email.
      await addAutomationEvent({
        automationId: auto.id, userId: auto.userId, kind: "email",
        title: `Read: ${email.subject}`, detail: { reason: decision.reason }, status: "skipped",
      })
    }
  }

  state.lastUid = Math.max(lastUid, maxUid)
  await patchAutomationState(auto.id, {
    state: JSON.stringify(state),
    stats: JSON.stringify(stats),
    lastRunAt: Date.now(),
    ...(actions > 0 ? { lastActionAt: Date.now() } : {}),
  })
  return { actions }
}

// Execute a previously-queued (approval-mode) reply after the user approves it.
export async function executeApprovedReply(auto: Automation, to: string, subject: string, body: string): Promise<boolean> {
  const user = await getUserById(auto.userId)
  if (!user) return false
  const t = getGmailTransport(user)
  if (!t) return false
  const res = await sendVia(t.transport, t.from, { to, subject, body })
  if (res.ok) {
    const stats = JSON.parse(auto.stats || "{}") as AutoStats
    stats.repliesSent = (stats.repliesSent ?? 0) + 1
    await patchAutomationState(auto.id, { stats: JSON.stringify(stats), lastActionAt: Date.now() })
  }
  return res.ok
}

// Trash a set of emails after approval (destructive — always gated).
export async function executeApprovedTrash(auto: Automation, uids: number[]): Promise<number> {
  const user = await getUserById(auto.userId)
  if (!user) return 0
  return trashMessages(user, uids)
}
