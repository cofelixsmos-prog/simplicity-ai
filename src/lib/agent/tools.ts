// Server-only agent tools. Each tool exposes an OpenAI-compatible function
// schema (sent to the model) and a `run` that returns text fed back into the
// loop, plus a short human label/detail for the UI's agent-activity panel.
//
// This file is imported only by the chat API route (server), so any API keys
// it reads never reach the client bundle.

import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { db, initDb } from "@/lib/db"
import { addMemory, setUserSettings } from "@/lib/db/repo"
import { drafts, apps, type User } from "@/lib/db/schema"
import { parseSettings, serializeSettings } from "@/lib/settings"
import { listMessages, modifyMessages, saveDraft, friendlyImapError, type ModifyAction } from "@/lib/imap"

export interface ToolSchema {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolResult {
  result: string // text handed back to the model
  detail?: string // short UI detail, e.g. "5 results"
  ui?: Record<string, unknown> // optional event to forward straight to the client UI
}

// One assistant message from a model turn (non-streaming shape).
export interface ModelMessage {
  content: string | null
  tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[]
}

// Context handed to tools that need to stream events or call the model
// themselves (e.g. spawn_agents running sub-agents, build_app delegating code).
export interface ToolCtx {
  emit: (ev: Record<string, unknown>) => void
  // A completion on the user's selected model — used for orchestration.
  complete: (messages: Record<string, unknown>[], tools?: ToolSchema[]) => Promise<ModelMessage>
  // A completion pinned to the dedicated coding model (d1 / OpenCode Zen),
  // regardless of which model the user is chatting on. Used by build_app.
  completeCoder: (messages: Record<string, unknown>[], tools?: ToolSchema[]) => Promise<ModelMessage>
  // Files uploaded in the current turn, available for prepare_email to attach.
  attachments?: { id: string; name: string }[]
  // The authenticated user row (with the encrypted Gmail App Password), for the
  // IMAP-backed tools (read/modify/draft). Absent when Gmail isn't connected.
  user?: User
}

interface AgentTool {
  schema: ToolSchema
  label: (args: Record<string, unknown>) => string
  run: (args: Record<string, unknown>, ctx?: ToolCtx) => Promise<ToolResult>
}

// ── web_search: Tavily (preferred) or Google Programmable Search ─────────────
// Tavily needs just one free key (TAVILY_API_KEY) and returns clean content plus
// a synthesized answer — ideal for grounding. Google Programmable Search works
// too if its two keys are set. Either provider makes research trustworthy.
async function webSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = String(args.query ?? "").trim()
  if (!query) return { result: "No query was provided.", detail: "no query" }

  if (process.env.TAVILY_API_KEY) {
    const r = await tavilySearch(query).catch(() => null)
    if (r) return r
  }
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
    const r = await googleSearch(query).catch(() => null)
    if (r) return r
  }
  return {
    result:
      "Live web search isn't configured on this server. Answer from your own knowledge, but CLEARLY warn the user " +
      "that live web grounding is unavailable — so anything time-sensitive (recent events, prices, specifics like " +
      "names/dates) may be inaccurate and should be verified. Do not fabricate precise facts you're unsure of.",
    detail: "not configured",
  }
}

async function tavilySearch(query: string): Promise<ToolResult | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 6,
        search_depth: "basic",
        include_answer: true,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      answer?: string
      results?: { title?: string; url?: string; content?: string }[]
    }
    const results = data.results ?? []
    if (results.length === 0 && !data.answer) return null
    const lines = results
      .slice(0, 6)
      .map((it, i) => `${i + 1}. ${it.title ?? "(untitled)"}\n   ${it.url ?? ""}\n   ${(it.content ?? "").slice(0, 300)}`)
    return {
      result:
        (data.answer ? `Synthesized answer: ${data.answer}\n\n` : "") +
        `Sources for "${query}":\n\n${lines.join("\n\n")}\n\n` +
        "Ground your answer in these and cite the relevant links.",
      detail: `${results.length} results`,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function googleSearch(query: string): Promise<ToolResult | null> {
  const key = process.env.GOOGLE_SEARCH_API_KEY as string
  const cx = process.env.GOOGLE_SEARCH_CX as string
  const url =
    `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}&num=5&q=${encodeURIComponent(query)}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { items?: { title?: string; link?: string; snippet?: string }[] }
    const items = data.items ?? []
    if (items.length === 0) return null
    const lines = items
      .slice(0, 5)
      .map((it, i) => `${i + 1}. ${it.title ?? "(untitled)"}\n   ${it.link ?? ""}\n   ${it.snippet ?? ""}`)
    return {
      result:
        `Top web results for "${query}":\n\n${lines.join("\n\n")}\n\n` +
        "Use these to ground your answer and cite the relevant links.",
      detail: `${items.length} results`,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── create_draft / update_draft: write essays/docs to the editable canvas ────
async function createDraft(args: Record<string, unknown>): Promise<ToolResult> {
  const title = (String(args.title ?? "").trim() || "Untitled draft").slice(0, 200)
  const content = String(args.content ?? "").trim()
  if (!content) return { result: "No content was provided for the draft.", detail: "empty" }

  await initDb()
  const id = randomUUID()
  const now = Date.now()
  await db.insert(drafts).values({ id, title, content, createdAt: now, updatedAt: now })

  return {
    result:
      `Draft created: "${title}" (id: ${id}). It is now open in the editor for the user to read and edit. ` +
      `To revise it later, call update_draft with this id.`,
    detail: title,
    ui: { t: "draft", id, title, content },
  }
}

async function updateDraft(args: Record<string, unknown>): Promise<ToolResult> {
  const id = String(args.id ?? "").trim()
  if (!id) return { result: "An existing draft id is required to update.", detail: "no id" }

  await initDb()
  const existing = (await db.select().from(drafts).where(eq(drafts.id, id)))[0]
  if (!existing) return { result: `No draft found with id ${id}.`, detail: "not found" }

  const content = args.content !== undefined ? String(args.content) : existing.content
  const title = args.title !== undefined ? String(args.title).slice(0, 200) : existing.title
  await db.update(drafts).set({ title, content, updatedAt: Date.now() }).where(eq(drafts.id, id))

  return {
    result: `Draft "${title}" (id: ${id}) updated and refreshed in the editor.`,
    detail: title,
    ui: { t: "draft", id, title, content },
  }
}

// ── build_app: delegate real coding to the dedicated coder model ─────────────
// The coding engine (d1 / OpenCode Zen) writes a complete, runnable multi-file
// frontend project. We parse its files, persist the project, and open it in the
// live code canvas. The orchestrating model never writes the code itself.

interface ProjectFile {
  name: string
  content: string
}

const CODER_SYSTEM = `You are an elite frontend engineer on the Simplicity team. Build a complete, polished, working frontend project from the user's request.

OUTPUT FORMAT — this is critical. Output ONLY the project files. Precede each file with a line in EXACTLY this form (nothing else on the line):
=== FILE: <path> ===
then that file's full raw contents. No prose, no commentary, and do NOT wrap files in markdown code fences. Example:
=== FILE: index.html ===
<!doctype html>
<html>...</html>
=== FILE: styles.css ===
:root { ... }

RULES
- ALWAYS make index.html the FIRST file — it is the entry point the preview boots from.
- Pick the simplest stack that fits: plain HTML/CSS/JS for most things; use React only when the UI genuinely needs components and state.
- For React: in index.html load React, ReactDOM and Babel standalone from a CDN (unpkg or jsdelivr), add <div id="root"></div>, and reference your component files with <script type="text/babel" src="app.jsx"></script>. Put components in separate .jsx files. The preview automatically inlines local files, so reference them by their plain filename (e.g. "app.jsx", "styles.css").
- Split concerns into multiple files (e.g. index.html + styles.css + app.js or app.jsx). Don't cram everything into one file unless it is genuinely tiny.
- Make it look genuinely great: modern and responsive, clean typography, generous spacing, a cohesive palette, real hover/focus states and small touches of polish. Match the requested vibe; when unspecified, a refined dark theme usually looks best.
- It MUST run with no build step and no server — only CDN dependencies, no npm imports or bundlers. Keep everything client-side; no calls to private/authenticated APIs.
Write the full, production-quality files now.`

// A terser, more forceful retry prompt for when the first attempt returns
// nothing parseable (the reasoning model sometimes rambles instead of emitting).
const CODER_RETRY_SYSTEM = `You are a frontend engineer. Output a complete, runnable project as raw files ONLY.
For each file, write a line exactly like "=== FILE: index.html ===" then the file's contents. Start with index.html.
No thinking out loud, no explanations, no markdown fences — just the === FILE: markers and file contents. Keep it focused and working.`

function stripFence(body: string): string {
  const b = body.replace(/^\s*```[a-zA-Z0-9]*[^\n]*\n/, "").replace(/\n```\s*$/, "")
  return b.replace(/^\n+/, "").replace(/\s+$/, "") + "\n"
}

// Guess a filename for a fenced block that had no explicit name, from its language.
function defaultName(lang: string, used: Set<string>): string {
  const map: Record<string, string> = {
    html: "index.html",
    css: "styles.css",
    js: "script.js",
    javascript: "script.js",
    jsx: "app.jsx",
    tsx: "app.jsx",
    ts: "app.js",
    typescript: "app.js",
    json: "data.json",
  }
  let name = map[lang.toLowerCase()] ?? "file.txt"
  // Avoid collisions (e.g. two js blocks) by numbering the later ones.
  if (used.has(name)) {
    const dot = name.lastIndexOf(".")
    let n = 2
    let candidate: string
    do {
      candidate = `${name.slice(0, dot)}-${n}${name.slice(dot)}`
      n++
    } while (used.has(candidate))
    name = candidate
  }
  return name
}

// Parse the coder's output into files. Tries, in order: explicit "=== FILE: ==="
// markers, named/typed code fences, then a single raw HTML document. This
// tolerance is what keeps builds from failing when the model drifts off-format.
function parseProjectFiles(text: string): ProjectFile[] {
  // 1) Explicit "=== FILE: name ===" markers (our requested format).
  if (/===\s*FILE:/i.test(text)) {
    const parts = text.split(/^[ \t]*===\s*FILE:\s*(.+?)\s*===[ \t]*$/gim)
    const files: ProjectFile[] = []
    for (let i = 1; i < parts.length; i += 2) {
      const name = parts[i].trim().replace(/^["'`]+|["'`]+$/g, "").slice(0, 200)
      const body = stripFence(parts[i + 1] ?? "")
      if (name && body.trim()) files.push({ name, content: body })
    }
    if (files.length) return files
  }

  // 2) Code fences, using any filename in the info string, else the language.
  const fenceRe = /```([a-zA-Z0-9]*)([^\n]*)\n([\s\S]*?)```/g
  const fenced: ProjectFile[] = []
  const used = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text)) !== null) {
    const lang = m[1] ?? ""
    const info = m[2] ?? ""
    const body = (m[3] ?? "").replace(/\s+$/, "") + "\n"
    if (!body.trim()) continue
    const named =
      /(?:file|name|title|path)\s*=?\s*["']?([\w./-]+\.\w+)["']?/i.exec(info)?.[1] ??
      /\b([\w./-]+\.(?:html?|css|jsx?|tsx?|json))\b/i.exec(info)?.[1]
    const name = (named ?? defaultName(lang, used)).replace(/^\.?\//, "")
    used.add(name)
    fenced.push({ name, content: body })
  }
  if (fenced.length) return fenced

  // 3) Whole response is (or contains) a single HTML document.
  if (/<!doctype html|<html[\s>]/i.test(text)) {
    const start = text.search(/<!doctype html|<html[\s>]/i)
    return [{ name: "index.html", content: text.slice(start).replace(/\s+$/, "") + "\n" }]
  }

  return []
}

function pickEntry(files: ProjectFile[]): string {
  const index = files.find((f) => /(^|\/)index\.html$/i.test(f.name))
  const anyHtml = files.find((f) => /\.html?$/i.test(f.name))
  return (index ?? anyHtml ?? files[0]).name
}

async function buildApp(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const title = (String(args.title ?? "").trim() || "Untitled app").slice(0, 200)
  const spec = String(args.spec ?? "").trim()
  if (!ctx) return { result: "Coding is unavailable in this context.", detail: "error" }
  if (!spec) return { result: "No build spec was provided.", detail: "empty" }

  // Granular activity so the user can watch the build unfold (design → files → preview).
  const sid = randomUUID()
  const design = (status: string, detail?: string) =>
    ctx.emit({ t: "step", id: `${sid}-design`, tool: "design", label: `Designing “${title}”`, status, detail })

  design("running")

  // Delegate to the dedicated coder model, retrying once with a stricter prompt
  // if the first attempt comes back empty/unparseable.
  let files: ProjectFile[] = []
  for (let attempt = 0; attempt < 2 && files.length === 0; attempt++) {
    if (attempt === 1)
      ctx.emit({ t: "step", id: `${sid}-retry`, tool: "design", label: "Reworking the build", status: "running" })
    const msg = await ctx.completeCoder([
      { role: "system", content: attempt === 0 ? CODER_SYSTEM : CODER_RETRY_SYSTEM },
      { role: "user", content: spec },
    ])
    files = parseProjectFiles(String(msg.content ?? ""))
    if (attempt === 1)
      ctx.emit({
        t: "step",
        id: `${sid}-retry`,
        tool: "design",
        label: "Reworking the build",
        status: files.length ? "done" : "error",
      })
  }

  if (files.length === 0) {
    design("error")
    return {
      result:
        "The coding engine could not produce a working project after two attempts (it may be overloaded or " +
        "timed out). Do NOT silently retry the same way — briefly tell the user the build didn't go through and " +
        "ask whether they'd like you to try again or simplify the scope.",
      detail: "failed",
    }
  }

  design("done", `${files.length} files`)

  // Show each file as it's written into the project.
  files.forEach((f, i) => {
    const lines = f.content.replace(/\n$/, "").split("\n").length
    ctx.emit({
      t: "step",
      id: `${sid}-f${i}`,
      tool: "write_file",
      label: `Wrote ${f.name}`,
      status: "done",
      detail: `${lines} ${lines === 1 ? "line" : "lines"}`,
    })
  })

  const entry = pickEntry(files)
  await initDb()
  const id = randomUUID()
  const now = Date.now()
  await db.insert(apps).values({ id, title, files: JSON.stringify(files), entry, createdAt: now, updatedAt: now })

  ctx.emit({ t: "step", id: `${sid}-run`, tool: "preview", label: "Opened live preview", status: "done", detail: "ready" })

  const fileList = files.map((f) => f.name).join(", ")
  return {
    result:
      `Built "${title}" — ${files.length} file(s): ${fileList}. The project is now open in the live code ` +
      `canvas. Its app id is "${id}". To EDIT this app later (tweak, add features, fix something), call ` +
      `update_app with this id — do NOT call build_app again, which creates a separate new project and loses this ` +
      `design. Give a brief one-line summary of what you built and point them to the canvas. Do NOT paste code into chat.`,
    detail: `${files.length} files`,
    ui: { t: "code", id, title, files, entry },
  }
}

// ── update_app: edit an existing project in place (keeps its id & design) ─────
// Loads the current files, hands them to the coder with the requested change,
// and writes the result back to the SAME app record so the canvas refreshes
// rather than spawning a brand-new, differently-styled project.
async function updateApp(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const id = String(args.id ?? "").trim()
  const changes = String(args.changes ?? "").trim()
  if (!ctx) return { result: "Coding is unavailable in this context.", detail: "error" }
  if (!id) return { result: "An existing app id is required to edit. It was returned by build_app.", detail: "no id" }
  if (!changes) return { result: "Describe what to change.", detail: "empty" }

  await initDb()
  const existing = (await db.select().from(apps).where(eq(apps.id, id)))[0]
  if (!existing)
    return {
      result: `No app found with id "${id}" (it may be from an earlier session). Build a new one with build_app instead.`,
      detail: "not found",
    }

  let currentFiles: ProjectFile[] = []
  try {
    currentFiles = JSON.parse(existing.files) as ProjectFile[]
  } catch {
    /* corrupt — treat as empty, coder will rebuild from the change desc */
  }

  const sid = randomUUID()
  const edit = (status: string, detail?: string) =>
    ctx.emit({ t: "step", id: `${sid}-edit`, tool: "design", label: `Editing “${existing.title}”`, status, detail })
  edit("running")

  const filesText = currentFiles.map((f) => `=== FILE: ${f.name} ===\n${f.content}`).join("\n")
  const spec =
    `Here is the CURRENT project. Apply the requested change and return the COMPLETE updated project — ALL files, ` +
    `including unchanged ones — in the same "=== FILE: name ===" format. Preserve the existing structure, styling ` +
    `and design; change only what the request asks for.\n\n` +
    `CURRENT PROJECT:\n${filesText}\n\nREQUESTED CHANGE:\n${changes}`

  let files: ProjectFile[] = []
  for (let attempt = 0; attempt < 2 && files.length === 0; attempt++) {
    const msg = await ctx.completeCoder([
      { role: "system", content: attempt === 0 ? CODER_SYSTEM : CODER_RETRY_SYSTEM },
      { role: "user", content: spec },
    ])
    files = parseProjectFiles(String(msg.content ?? ""))
  }

  if (files.length === 0) {
    edit("error")
    return {
      result:
        "The edit didn't go through (the coding engine may be overloaded or timed out). Tell the user briefly and " +
        "ask if they'd like to try again — do NOT silently rebuild from scratch.",
      detail: "failed",
    }
  }

  edit("done", `${files.length} files`)
  files.forEach((f, i) => {
    const lines = f.content.replace(/\n$/, "").split("\n").length
    ctx.emit({ t: "step", id: `${sid}-f${i}`, tool: "write_file", label: `Updated ${f.name}`, status: "done", detail: `${lines} ${lines === 1 ? "line" : "lines"}` })
  })

  const entry = pickEntry(files)
  await db.update(apps).set({ files: JSON.stringify(files), entry, updatedAt: Date.now() }).where(eq(apps.id, id))
  ctx.emit({ t: "step", id: `${sid}-run`, tool: "preview", label: "Refreshed preview", status: "done", detail: "ready" })

  return {
    result:
      `Updated "${existing.title}" (id "${id}") in place — the same project was edited and the canvas refreshed. ` +
      `Give a one-line summary of what changed. For further edits, call update_app again with this same id.`,
    detail: `${files.length} files`,
    ui: { t: "code", id, title: existing.title, files, entry },
  }
}

// ── prepare_email: stage email(s) for the user's explicit approval ───────────
// This NEVER sends. It validates the drafts and emits a UI event that renders
// an approval card in chat; the user reviews and clicks Send, which hits the
// authenticated /api/email/send endpoint. Sending without a human click is
// impossible by construction.
const EMAIL_ADDR_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface EmailAttachment {
  id: string
  name: string
}
interface StagedEmail {
  to: string
  subject: string
  body: string
  attachments?: EmailAttachment[]
}

async function prepareEmail(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const raw = Array.isArray(args.emails) ? (args.emails as Record<string, unknown>[]) : []
  const avail = ctx?.attachments ?? [] // files uploaded this turn
  const byName = new Map(avail.map((a) => [a.name.toLowerCase(), a]))

  const emails: StagedEmail[] = []
  const invalid: string[] = []
  const single = raw.length === 1
  for (const e of raw.slice(0, 200)) {
    const to = String(e?.to ?? "").trim()
    const subject = String(e?.subject ?? "").trim().slice(0, 300)
    const body = String(e?.body ?? "").trim().slice(0, 50_000)
    if (!EMAIL_ADDR_RE.test(to)) {
      invalid.push(to || "(blank)")
      continue
    }
    // Resolve requested attachment filenames → uploaded files. If none were
    // named but there's a single email and files were uploaded this turn,
    // attach them all (the "send this PDF to X" default).
    let attachments: EmailAttachment[] | undefined
    const named = Array.isArray(e?.attachments) ? (e.attachments as unknown[]).map((n) => String(n)) : null
    if (named && named.length) {
      const resolved = named.map((n) => byName.get(n.toLowerCase())).filter((a): a is EmailAttachment => !!a)
      if (resolved.length) attachments = resolved
    } else if (single && avail.length) {
      attachments = avail
    }
    emails.push({ to, subject, body, attachments })
  }

  if (emails.length === 0) {
    return {
      result:
        "No valid recipient email addresses were provided, so nothing was staged. " +
        (invalid.length ? `Invalid: ${invalid.join(", ")}. ` : "") +
        "Ask the user for a valid recipient address — never invent one.",
      detail: "no valid recipients",
    }
  }

  const batchId = randomUUID()
  const noun = emails.length === 1 ? "email" : `${emails.length} emails`
  const attachedCount = emails.reduce((n, e) => n + (e.attachments?.length ?? 0), 0)
  return {
    result:
      `Staged ${noun} for the user's approval — an approval card is now showing in chat with the recipient(s), ` +
      `subject, body${attachedCount ? " and attachment(s)" : ""}. The email is NOT sent yet: the user must review ` +
      `and click Send (or Approve All). ` +
      `${invalid.length ? `Note: ${invalid.length} invalid address(es) were skipped (${invalid.join(", ")}). ` : ""}` +
      `${avail.length && attachedCount === 0 ? "Note: uploaded file(s) were NOT attached — if the user wanted them attached, list their filenames in each email's attachments. " : ""}` +
      `Tell the user it's ready to review, in one short line. Do not repeat the full body in chat.`,
    detail: attachedCount ? `${noun}, ${attachedCount} file(s)` : noun,
    ui: { t: "email", batchId, emails },
  }
}

// ── read_emails: fetch/search the user's Gmail inbox (IMAP, read-only) ───────
async function readEmails(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!(ctx?.user?.gmailAppPassword || ctx?.user?.gmailRefreshToken))
    return { result: "Gmail isn't connected, so the inbox can't be read. Tell the user to connect Gmail first.", detail: "not connected" }
  const query = args.query ? String(args.query).slice(0, 200) : undefined
  const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 40)
  const full = args.full === true
  try {
    const items = await listMessages(ctx.user, { query, limit, full })
    if (items.length === 0)
      return { result: query ? `No emails matched "${query}".` : "The inbox is empty.", detail: "0 emails" }
    ctx.emit({ t: "inbox", items: items.map((i) => ({ uid: i.uid, from: i.from, subject: i.subject, date: i.date, seen: i.seen, flagged: i.flagged, snippet: i.snippet })) })
    const lines = items.map(
      (i) =>
        `[id ${i.uid}]${i.seen ? "" : " (unread)"} From: ${i.from} | Subject: ${i.subject} | ${i.date}\n  ${full ? (i.body || i.snippet) : i.snippet}`
    )
    return {
      result:
        `Fetched ${items.length} email(s)${query ? ` matching "${query}"` : ""}. Reference any of them by their id ` +
        `for follow-up actions (reply via prepare_email, delete_emails, modify_emails):\n\n${lines.join("\n\n")}`,
      detail: `${items.length} emails`,
    }
  } catch (e) {
    return { result: `Couldn't read the inbox: ${friendlyImapError(e)}.`, detail: "error" }
  }
}

// ── delete_emails: stage a move-to-Trash for the user's explicit approval ─────
// Like prepare_email, this NEVER deletes directly — it emits a confirmation card
// and the actual move-to-Trash happens via the authenticated /api/email/delete
// endpoint only after the user clicks.
async function deleteEmails(args: Record<string, unknown>): Promise<ToolResult> {
  const raw = Array.isArray(args.emails) ? (args.emails as Record<string, unknown>[]) : []
  const items = raw
    .map((e) => ({ uid: Number(e?.id), subject: String(e?.subject ?? "(no subject)").slice(0, 200), from: String(e?.from ?? "").slice(0, 200) }))
    .filter((e) => Number.isFinite(e.uid))
    .slice(0, 100)
  if (items.length === 0)
    return { result: "No valid email ids were provided to delete. Read the inbox first to get ids.", detail: "no ids" }
  const batchId = randomUUID()
  return {
    result:
      `Staged ${items.length} email(s) for deletion — a confirmation card is now showing. Nothing is deleted ` +
      `until the user clicks Move to Trash. Tell them it's ready to confirm, in one short line.`,
    detail: `${items.length} to delete`,
    ui: { t: "email_delete", batchId, items },
  }
}

// ── modify_emails: change message state (flags / archive), reversible ────────
async function modifyEmails(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!(ctx?.user?.gmailAppPassword || ctx?.user?.gmailRefreshToken))
    return { result: "Gmail isn't connected. Tell the user to connect Gmail first.", detail: "not connected" }
  const ids = Array.isArray(args.ids) ? (args.ids as unknown[]).map((n) => Number(n)).filter(Number.isFinite) : []
  const action = String(args.action ?? "") as ModifyAction
  const valid: ModifyAction[] = ["mark_read", "mark_unread", "star", "unstar", "archive"]
  if (!valid.includes(action)) return { result: `Unknown action "${action}". Use one of: ${valid.join(", ")}.`, detail: "bad action" }
  if (ids.length === 0) return { result: "No valid email ids were provided.", detail: "no ids" }
  try {
    const n = await modifyMessages(ctx.user, ids, action)
    return { result: `${action.replace("_", " ")} applied to ${n} email(s).`, detail: `${n} updated` }
  } catch (e) {
    return { result: `Couldn't update the email(s): ${friendlyImapError(e)}.`, detail: "error" }
  }
}

// ── save_draft: create a draft in the user's Gmail Drafts folder ──────────────
async function saveDraftTool(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!(ctx?.user?.gmailAppPassword || ctx?.user?.gmailRefreshToken))
    return { result: "Gmail isn't connected. Tell the user to connect Gmail first.", detail: "not connected" }
  const to = String(args.to ?? "").trim()
  const subject = String(args.subject ?? "").trim().slice(0, 300)
  const body = String(args.body ?? "").slice(0, 50_000)
  if (!to && !subject && !body) return { result: "The draft is empty.", detail: "empty" }
  try {
    await saveDraft(ctx.user, { to, subject, body })
    return { result: `Draft saved to Gmail Drafts${to ? ` (to ${to})` : ""}. The user can find it in Gmail.`, detail: "draft saved" }
  } catch (e) {
    return { result: `Couldn't save the draft: ${friendlyImapError(e)}.`, detail: "error" }
  }
}

// ── control_ui: change app settings/appearance on the user's behalf ─────────
// Emits a UI event the chat client applies (night warmth, focus mode, ambient
// sound); the auto_* preferences also persist to the account.
async function controlUi(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const action = String(args.action ?? "")
  const value = String(args.value ?? "") === "on" ? "on" : "off"
  const level = ["light", "deep", "study"].includes(String(args.level)) ? String(args.level) : undefined

  const NAMES: Record<string, string> = {
    night: "Night mode (warm, dimmed ambience)",
    focus: "Focus mode",
    ambient_sound: "Ambient study sound",
    auto_night: "Auto Night (evening wind-down)",
    auto_morning: "Auto Morning (cool morning drift)",
  }
  if (!NAMES[action]) {
    return { result: `Unknown setting "${action}". Available: ${Object.keys(NAMES).join(", ")}.`, detail: "unknown" }
  }

  // Persist account-level preferences; ambient/visual ones are session-local.
  if ((action === "auto_night" || action === "auto_morning") && ctx?.user) {
    const s = parseSettings(ctx.user.settings)
    if (action === "auto_night") s.autoNight = value === "on"
    else s.autoMorning = value === "on"
    await setUserSettings(ctx.user.id, serializeSettings(s)).catch(() => {})
  }

  return {
    result:
      `Done — ${NAMES[action]} is now ${value}${action === "focus" && level ? ` (${level})` : ""}. ` +
      "The change is already applied on screen; confirm it briefly and naturally.",
    detail: `${action} ${value}`,
    ui: { t: "ui_control", control: action, value, ...(level ? { level } : {}) },
  }
}

// ── create_pdf: generate a REAL PDF file (attachable, downloadable) ──────────
// Unlike the inline ```pdf preview block, this produces actual PDF bytes stored
// server-side, so it can be attached to an email, saved, and downloaded.
async function createPdf(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!ctx?.user) return { result: "Can't create a file here (no signed-in user).", detail: "no user" }

  const spec = {
    title: args.title ? String(args.title).slice(0, 300) : undefined,
    subtitle: args.subtitle ? String(args.subtitle).slice(0, 400) : undefined,
    accent: args.accent ? String(args.accent) : undefined,
    blocks: Array.isArray(args.blocks) ? (args.blocks as unknown[]) : [],
  }
  if (!spec.blocks.length && !spec.title)
    return { result: "Provide a title and content blocks for the PDF.", detail: "empty" }

  let buf: Buffer
  try {
    const { renderPdf } = await import("@/lib/pdf")
    buf = renderPdf(spec as Parameters<typeof import("@/lib/pdf").renderPdf>[0])
  } catch {
    return { result: "Couldn't render that PDF — check the blocks are valid.", detail: "render error" }
  }

  const base =
    String(args.filename || spec.title || "document")
      .replace(/\.pdf$/i, "")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80) || "document"
  const name = `${base}.pdf`

  const { createUpload } = await import("@/lib/db/repo")
  const id = await createUpload(ctx.user.id, name, "application/pdf", buf.toString("base64"))

  // Register it as a turn attachment so a following prepare_email attaches it.
  ctx.attachments = [...(ctx.attachments ?? []), { id, name }]

  return {
    result:
      `Created the PDF “${name}” (${Math.round(buf.length / 1024)} KB). It's shown to the user as a document preview with a download button, ` +
      `and it's staged as an attachment. To EMAIL it: call prepare_email now and put “${name}” in that email's ` +
      `attachments array (for a single email it also auto-attaches). To save it to Drive, mention it — it's stored.`,
    detail: name,
    ui: { t: "file" as const, id, name, mime: "application/pdf", size: buf.length, spec },
  }
}

// ── list_artifacts: the apps/drafts the user has already made ────────────────
async function listArtifacts(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!ctx?.user) return { result: "Can't list artifacts here.", detail: "no user" }
  const { listUserArtifacts } = await import("@/lib/db/repo")
  const items = await listUserArtifacts(ctx.user.id, 30).catch(() => [])
  if (items.length === 0)
    return { result: "The user hasn't made any apps or documents yet — nothing saved to reopen.", detail: "0" }
  const lines = items.map((a, i) => `${i + 1}. ${a.title} — ${a.kind} · id: ${a.id}`)
  return {
    result:
      `Artifacts the user has already created (from earlier in this or other chats):\n${lines.join("\n")}\n\n` +
      "To change one, call update_app or update_draft with its id — don't rebuild it from scratch.",
    detail: `${items.length} artifacts`,
  }
}

// ── Google Drive: search / read / save files ────────────────────────────────
const driveReconnectMsg =
  "Drive access hasn't been granted yet (the Google connection predates Drive support). " +
  "Tell the user to reconnect Google from Settings to grant Drive access."

async function searchDrive(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!(ctx?.user?.gmailRefreshToken))
    return { result: "Google Drive isn't connected. Tell the user to connect Google from Settings.", detail: "not connected" }
  const { searchDrive: run, RECONNECT, kindOf } = await import("@/lib/drive")
  const query = args.query ? String(args.query).slice(0, 200) : undefined
  const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 40)
  const r = await run(ctx.user, query, limit).catch(() => ({ error: "The Drive search failed." }))
  if ("error" in r) return { result: r.error === RECONNECT ? driveReconnectMsg : r.error, detail: "error" }
  if (r.files.length === 0) return { result: query ? `No Drive files match "${query}".` : "No files found in Drive.", detail: "0 results" }
  const lines = r.files.map((f, i) => `${i + 1}. ${f.name} [${kindOf(f.mimeType)}]\n   id: ${f.id}\n   ${f.link}`)
  return {
    result: `Drive files${query ? ` for "${query}"` : ""}:\n\n${lines.join("\n\n")}\n\nUse read_drive_file with an id to read one.`,
    detail: `${r.files.length} files`,
  }
}

async function readDriveFile(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!(ctx?.user?.gmailRefreshToken))
    return { result: "Google Drive isn't connected. Ask the user to connect Google first.", detail: "not connected" }
  const fileId = String(args.file_id ?? "").trim()
  if (!fileId) return { result: "No file id was given. Use search_drive to find one first.", detail: "no id" }
  const { readDriveFile: run, RECONNECT } = await import("@/lib/drive")
  const r = await run(ctx.user, fileId).catch(() => ({ error: "Couldn't read that file." }))
  if ("error" in r) return { result: r.error === RECONNECT ? driveReconnectMsg : r.error, detail: "error" }
  return { result: `Contents of “${r.name}”:\n\n${r.text}`, detail: r.name.slice(0, 40) }
}

async function saveToDrive(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  if (!(ctx?.user?.gmailRefreshToken))
    return { result: "Google Drive isn't connected. Ask the user to connect Google first.", detail: "not connected" }
  const name = String(args.name ?? "").trim().slice(0, 200)
  const content = String(args.content ?? "")
  if (!name || !content) return { result: "Both a file name and content are required to save to Drive.", detail: "missing" }
  const mimeType = String(args.mime_type || "text/markdown")
  const { createDriveFile: run, RECONNECT } = await import("@/lib/drive")
  const r = await run(ctx.user, name, content, mimeType).catch(() => ({ error: "Couldn't save to Drive." }))
  if ("error" in r) return { result: r.error === RECONNECT ? driveReconnectMsg : r.error, detail: "error" }
  return {
    result: `Saved “${r.name}” to the user's Google Drive. Share the link so they can open it: ${r.link}`,
    detail: r.name.slice(0, 40),
  }
}

// ── manage_gmail: test / disconnect the user's Gmail from chat (connecting is Settings-only) ─────
async function manageGmail(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const action = String(args.action ?? "")
  const connected = !!(ctx?.user?.gmailAppPassword || ctx?.user?.gmailRefreshToken)

  if (action === "test") {
    if (!ctx?.user || !connected) {
      return {
        result: "No Gmail is connected yet, so there's nothing to test. Offer to connect it (action=connect).",
        detail: "not connected",
        ui: { t: "gmail_status", connected: false },
      }
    }
    const { verifyGmail } = await import("@/lib/email")
    const r = await verifyGmail(ctx.user).catch(() => ({ ok: false, error: "The test couldn't run." }))
    return {
      result: r.ok
        ? "Gmail connection verified — sending works. Confirm briefly."
        : `Gmail test failed: ${r.error ?? "unknown error"}. Tell the user plainly and suggest reconnecting (action=connect) with a fresh App Password.`,
      detail: r.ok ? "ok" : "failed",
      ui: { t: "gmail_status", connected, ok: r.ok, error: r.ok ? undefined : r.error },
    }
  }

  if (action === "disconnect") {
    return {
      result: connected
        ? "Disconnecting the user's Gmail. Confirm it's removed."
        : "No Gmail was connected. Nothing to disconnect.",
      detail: "disconnect",
      ui: { t: "gmail_disconnect" },
    }
  }

  return { result: `Unknown Gmail action "${action}". Use test or disconnect.`, detail: "unknown" }
}

// ── remember: save a durable fact about the user to long-term memory ─────────
async function remember(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const fact = String(args.fact ?? "").trim()
  if (!fact) return { result: "Nothing to remember — no fact given.", detail: "empty" }
  if (!ctx?.user) return { result: "Can't save to memory here (user not identified). Just continue.", detail: "no user" }
  const saved = await addMemory(ctx.user.id, fact).catch(() => null)
  if (!saved) return { result: "Already in memory — nothing new to save.", detail: "known" }
  return {
    result: `Saved to long-term memory: "${saved.content}". Don't recite it back; just continue naturally.`,
    detail: saved.content.slice(0, 40),
  }
}

// ── get_datetime: zero-config, proves the loop end-to-end ────────────────────
async function getDatetime(): Promise<ToolResult> {
  const now = new Date()
  return {
    result: `The current date and time is ${now.toISOString()} (UTC).`,
    detail: now.toUTCString().replace("GMT", "UTC"),
  }
}

// ── Sub-agents: spawn_agents lets the model delegate to a team of workers ────
const SUB_MAX_STEPS = 3
const MAX_SUBAGENTS = 3 // parallel cap — bounds memory/concurrency on small instances

type AgentKind = "research" | "writer" | "coder" | "general"

function subagentPrompt(name: string, kind: AgentKind): string {
  const base =
    `You are "${name}", a focused sub-agent on a team coordinated by Simplicity. ` +
    `Complete ONLY your assigned task, then return a concise result with no preamble and no questions. `
  const tips: Record<AgentKind, string> = {
    research:
      "Use web_search to ground every claim in current sources and cite the key links in your result.",
    writer:
      "When the task is to write a document, essay, report or other long-form copy, call create_draft with the full Markdown.",
    coder:
      "When the task is to build a UI, app, website, page or interactive tool, call build_app with a clear title and a detailed spec.",
    general:
      "Use your tools as needed to actually produce the deliverable: web_search to research, create_draft to write documents, build_app to build UIs/apps.",
  }
  return base + tips[kind]
}

interface SubAgentSpec {
  id: string
  name: string
  task: string
  kind: AgentKind
}

async function runSubAgent(spec: SubAgentSpec, ctx: ToolCtx): Promise<string> {
  const { id, name, task, kind } = spec
  ctx.emit({ t: "agent", id, name, task, status: "running" })

  const convo: Record<string, unknown>[] = [
    { role: "system", content: subagentPrompt(name, kind) },
    { role: "user", content: task },
  ]

  try {
    for (let step = 0; step < SUB_MAX_STEPS; step++) {
      const msg = await ctx.complete(convo, SUBAGENT_TOOL_SCHEMAS)
      const calls = msg.tool_calls ?? []

      if (calls.length === 0) {
        const final = String(msg.content ?? "").trim()
        ctx.emit({ t: "agent", id, name, task, status: "done", summary: final.slice(0, 300) })
        return final || "(no output)"
      }

      convo.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls })
      for (const tc of calls) {
        const stepId = tc.id
        const toolName = tc.function?.name ?? ""
        let a: Record<string, unknown> = {}
        try {
          a = JSON.parse(tc.function?.arguments || "{}")
        } catch {
          /* keep empty */
        }
        const tool = SUBAGENT_TOOLS[toolName]
        const label = tool ? tool.label(a) : `Running ${toolName}`
        ctx.emit({ t: "agent_step", agentId: id, id: stepId, tool: toolName, label, status: "running" })
        // Pass ctx so deliverable tools (create_draft, build_app) work and can
        // open their canvas in the UI.
        const r = tool ? await tool.run(a, ctx) : { result: `Unknown tool: ${toolName}`, detail: "error" }
        ctx.emit({
          t: "agent_step",
          agentId: id,
          id: stepId,
          tool: toolName,
          label,
          status: r.detail === "error" ? "error" : "done",
          detail: r.detail,
        })
        // Forward any UI payload (an opened draft / code canvas) to the client.
        if (r.ui) ctx.emit(r.ui)
        convo.push({ role: "tool", tool_call_id: stepId, content: r.result })
      }
    }
    ctx.emit({ t: "agent", id, name, task, status: "done", summary: "(reached step limit)" })
    return "(reached step limit without a final answer)"
  } catch {
    ctx.emit({ t: "agent", id, name, task, status: "error" })
    return `${name} hit an error.`
  }
}

function normalizeKind(raw: unknown): AgentKind {
  const k = String(raw ?? "").toLowerCase()
  if (k === "research" || k === "writer" || k === "coder" || k === "general") return k
  if (k === "write" || k === "writing" || k === "docs" || k === "document") return "writer"
  if (k === "code" || k === "coding" || k === "engineer" || k === "developer") return "coder"
  if (k === "search" || k === "researcher") return "research"
  return "general"
}

async function spawnAgents(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const raw = Array.isArray(args.agents) ? (args.agents as Record<string, unknown>[]) : []
  const specs: SubAgentSpec[] = raw
    .slice(0, MAX_SUBAGENTS)
    .map((s, i) => ({
      id: randomUUID(),
      name: String(s?.name ?? `Agent ${i + 1}`).slice(0, 40),
      task: String(s?.task ?? "").trim(),
      kind: normalizeKind(s?.kind),
    }))
    .filter((s) => s.task)

  if (!ctx) return { result: "Sub-agents are unavailable in this context.", detail: "error" }
  if (specs.length === 0) return { result: "No valid sub-agent tasks were provided.", detail: "0 agents" }

  // Run the whole team in parallel; each streams its own progress to the UI.
  const results = await Promise.all(specs.map((s) => runSubAgent(s, ctx)))
  const combined = specs
    .map((s, i) => `### ${s.name} (${s.kind})\nTask: ${s.task}\nResult:\n${results[i]}`)
    .join("\n\n")

  return {
    result:
      `All ${specs.length} sub-agents have finished. Any documents or apps they produced are already open ` +
      `for the user. Synthesize their findings into one clear, well-organized answer:\n\n${combined}`,
    detail: `${specs.length} agents`,
  }
}

export const TOOLS: Record<string, AgentTool> = {
  web_search: {
    schema: {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the live web via Google for current, factual, or time-sensitive information. " +
          "Use it whenever the answer depends on recent events, prices, news, specs, or anything you are unsure of.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The web search query." },
          },
          required: ["query"],
        },
      },
    },
    label: (a) => `Searching the web for “${String(a.query ?? "").slice(0, 80)}”`,
    run: webSearch,
  },
  get_datetime: {
    schema: {
      type: "function",
      function: {
        name: "get_datetime",
        description:
          'Get the current date and time. Use when the user asks about "today", "now", or anything time-relative.',
        parameters: { type: "object", properties: {} },
      },
    },
    label: () => "Checking the current date and time",
    run: getDatetime,
  },
  create_draft: {
    schema: {
      type: "function",
      function: {
        name: "create_draft",
        description:
          "Write a draft, essay, article, or any long-form document. Call this whenever the user asks you to " +
          "WRITE something substantial (an essay, blog post, cover letter, report copy, story). It opens an " +
          "editable document canvas for the user. Put the full piece in `content` as Markdown.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "A short title for the document." },
            content: { type: "string", description: "The full document body in Markdown." },
          },
          required: ["title", "content"],
        },
      },
    },
    label: (a) => `Writing draft “${String(a.title ?? "Untitled").slice(0, 60)}”`,
    run: createDraft,
  },
  update_draft: {
    schema: {
      type: "function",
      function: {
        name: "update_draft",
        description:
          "Revise an existing draft you previously created. Pass the draft's id and the new full Markdown content.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "The id returned by create_draft." },
            title: { type: "string", description: "Optional new title." },
            content: { type: "string", description: "The full revised document body in Markdown." },
          },
          required: ["id", "content"],
        },
      },
    },
    label: (a) => `Revising draft ${String(a.id ?? "").slice(0, 8)}`,
    run: updateDraft,
  },
  build_app: {
    schema: {
      type: "function",
      function: {
        name: "build_app",
        description:
          "Build a complete, runnable frontend project — a website, web app, landing page, UI, dashboard, game, " +
          "interactive tool or component. Call this WHENEVER the user asks you to code, build, make or design a " +
          "website / app / page / UI. A specialized coding engine writes the multi-file project (HTML/CSS/JS or " +
          "React) and opens it in a live, editable preview canvas for the user. Do NOT write the code yourself — " +
          "delegate it here with a detailed spec. Use build_app ONLY for a brand-new project. To change an app you " +
          "already built, use update_app (not build_app) so the existing design is kept.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "A short title for the project, e.g. \"Pomodoro Timer\"." },
            spec: {
              type: "string",
              description:
                "A detailed description of exactly what to build: the purpose, the key features and content, " +
                "the layout, and any style/branding preferences. Be specific — this is the only instruction the " +
                "coding engine receives.",
            },
          },
          required: ["title", "spec"],
        },
      },
    },
    label: (a) => `Building “${String(a.title ?? "app").slice(0, 60)}”`,
    run: buildApp,
  },
  update_app: {
    schema: {
      type: "function",
      function: {
        name: "update_app",
        description:
          "Edit an app you ALREADY built, in place — keeping its existing files, structure and design. Call this " +
          "whenever the user asks to change, tweak, fix, add to, or restyle the current app/canvas (e.g. \"make the " +
          "button blue\", \"add a dark mode\", \"fix the layout\"). Pass the app's id (returned by build_app / shown " +
          "for the current app) and a clear description of the change. NEVER use build_app to modify an existing " +
          "app — that creates a new, differently-styled project and loses the current one.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "The id of the app to edit (from build_app's result / the open app)." },
            changes: {
              type: "string",
              description: "A clear description of exactly what to change, add, remove, or fix. The rest is preserved.",
            },
          },
          required: ["id", "changes"],
        },
      },
    },
    label: () => "Editing the app",
    run: updateApp,
  },
  prepare_email: {
    schema: {
      type: "function",
      function: {
        name: "prepare_email",
        description:
          "Prepare one or more emails for the user to review and send from their connected Gmail. Use this " +
          "whenever the user asks to email, send, or mail something to someone (e.g. \"send this to john@x.com\", " +
          "\"email all the invoices to their clients\", \"draft 5 emails\"). Write a clear, professional subject " +
          "and body for each. This does NOT send — it opens an approval card where the user clicks Send. NEVER " +
          "invent recipient addresses: if you don't have a real address, ask for it. For batch requests, add one " +
          "entry per recipient with that recipient's own tailored subject/body. " +
          "If the user uploaded files this turn (their names are noted in the message as \"[Attached PDF: name]\") " +
          "and wants them sent, put the exact filename(s) in that email's `attachments` array. For a single email, " +
          "any files uploaded this turn are attached automatically.",
        parameters: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              description: "The email(s) to stage — one object per recipient.",
              items: {
                type: "object",
                properties: {
                  to: { type: "string", description: "The recipient's email address (must be real, never fabricated)." },
                  subject: { type: "string", description: "A clear, professional subject line." },
                  body: { type: "string", description: "The full email body as plain text." },
                  attachments: {
                    type: "array",
                    description:
                      "Filenames of files uploaded this turn to attach to THIS email (must exactly match an uploaded filename). Omit if none.",
                    items: { type: "string" },
                  },
                },
                required: ["to", "subject", "body"],
              },
            },
          },
          required: ["emails"],
        },
      },
    },
    label: (a) => {
      const n = Array.isArray(a.emails) ? a.emails.length : 0
      return n === 1 ? "Preparing an email" : `Preparing ${n} emails`
    },
    run: prepareEmail,
  },
  read_emails: {
    schema: {
      type: "function",
      function: {
        name: "read_emails",
        description:
          "Read or search the user's Gmail inbox. Use when they ask what's in their inbox, to find or summarize " +
          "emails, or before replying/deleting (you need each email's id). Returns recent emails (or those matching " +
          "`query`) with sender, subject, date and a snippet. Set `full` to include full bodies when the user wants " +
          "you to actually read the contents. To reply, read first, then call prepare_email with a suitable body.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Optional search over sender / subject / body. Omit for the most recent emails." },
            limit: { type: "number", description: "How many to fetch (1–40, default 15)." },
            full: { type: "boolean", description: "Include full message bodies (use when the user wants the actual content read)." },
          },
        },
      },
    },
    label: (a) => (a.query ? `Searching inbox for “${String(a.query).slice(0, 40)}”` : "Reading the inbox"),
    run: readEmails,
  },
  delete_emails: {
    schema: {
      type: "function",
      function: {
        name: "delete_emails",
        description:
          "Move one or more emails to Gmail Trash (recoverable). This does NOT delete directly — it opens a " +
          "confirmation card the user must click. Get each email's id from read_emails first. Pass the id plus the " +
          "subject/from you saw, so the user can confirm exactly what will be trashed.",
        parameters: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              description: "The emails to trash.",
              items: {
                type: "object",
                properties: {
                  id: { type: "number", description: "The email id (uid) from read_emails." },
                  subject: { type: "string", description: "The subject you saw (for the confirmation card)." },
                  from: { type: "string", description: "The sender you saw (for the confirmation card)." },
                },
                required: ["id"],
              },
            },
          },
          required: ["emails"],
        },
      },
    },
    label: (a) => {
      const n = Array.isArray(a.emails) ? a.emails.length : 0
      return `Preparing to delete ${n} email${n === 1 ? "" : "s"}`
    },
    run: deleteEmails,
  },
  modify_emails: {
    schema: {
      type: "function",
      function: {
        name: "modify_emails",
        description:
          "Change the state of emails (reversible): mark read/unread, star/unstar, or archive (remove from inbox). " +
          "Get ids from read_emails first.",
        parameters: {
          type: "object",
          properties: {
            ids: { type: "array", description: "Email ids (uids) from read_emails.", items: { type: "number" } },
            action: {
              type: "string",
              enum: ["mark_read", "mark_unread", "star", "unstar", "archive"],
              description: "What to do to those emails.",
            },
          },
          required: ["ids", "action"],
        },
      },
    },
    label: (a) => `${String(a.action ?? "update").replace("_", " ")} email(s)`,
    run: modifyEmails,
  },
  save_draft: {
    schema: {
      type: "function",
      function: {
        name: "save_draft",
        description:
          "Save an email draft into the user's Gmail Drafts folder (does not send). Use when they ask you to draft/" +
          "compose an email and save it for later, or to edit an email by saving a revised draft. To actually send, " +
          "use prepare_email instead.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient address (may be blank for an unaddressed draft)." },
            subject: { type: "string", description: "Subject line." },
            body: { type: "string", description: "The draft body as plain text." },
          },
          required: ["subject", "body"],
        },
      },
    },
    label: () => "Saving a Gmail draft",
    run: saveDraftTool,
  },
  create_pdf: {
    schema: {
      type: "function",
      function: {
        name: "create_pdf",
        description:
          "Generate a REAL, downloadable PDF file (not just a preview) that can be attached to an email or saved. " +
          "Use this whenever a PDF needs to actually exist — the user asks to email a PDF, download one, or save one. " +
          "After calling it, the file is staged; call prepare_email next (listing the returned filename in attachments) " +
          "to send it. Same block format as the inline pdf preview.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Document title (shown on the cover)." },
            subtitle: { type: "string", description: "Optional subtitle." },
            accent: { type: "string", description: "Optional hex accent color, e.g. DC2626." },
            filename: { type: "string", description: "Optional file name (without .pdf); defaults from the title." },
            blocks: {
              type: "array",
              description:
                "Content blocks, in order. Each is one of: {type:'heading',text,level:1|2}, {type:'paragraph',text}, " +
                "{type:'list',items:[...],ordered?}, {type:'table',columns:[...],rows:[[...]]}, {type:'callout',text}, {type:'divider'}.",
              items: { type: "object" },
            },
          },
          required: ["title", "blocks"],
        },
      },
    },
    label: (a) => `Creating PDF “${String(a.title ?? "document").slice(0, 50)}”`,
    run: createPdf,
  },
  list_artifacts: {
    schema: {
      type: "function",
      function: {
        name: "list_artifacts",
        description:
          "List the apps and documents the user has already created (across all their chats), with ids. Use when " +
          "they refer to something you made before (\"the app you built\", \"my report\", \"that draft\") so you can " +
          "reopen or edit it with update_app / update_draft instead of starting over.",
        parameters: { type: "object", properties: {} },
      },
    },
    label: () => "Looking up your artifacts",
    run: listArtifacts,
  },
  search_drive: {
    schema: {
      type: "function",
      function: {
        name: "search_drive",
        description:
          "Search or list the user's Google Drive files. Use when they ask about their Drive, a document/sheet/slide " +
          "they have, or to find a file before reading it. Returns names + ids; pass an id to read_drive_file.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Words to match in file names/contents. Omit to list recent files." },
            limit: { type: "number", description: "Max results (default 15)." },
          },
        },
      },
    },
    label: (a) => (a.query ? `Searching Drive for “${String(a.query).slice(0, 60)}”` : "Listing Drive files"),
    run: searchDrive,
  },
  read_drive_file: {
    schema: {
      type: "function",
      function: {
        name: "read_drive_file",
        description:
          "Read the text of a Google Drive file by id (from search_drive). Google Docs/Sheets/Slides and text files " +
          "are supported; binary files return a link instead.",
        parameters: {
          type: "object",
          properties: { file_id: { type: "string", description: "The Drive file id from search_drive." } },
          required: ["file_id"],
        },
      },
    },
    label: () => "Reading a Drive file",
    run: readDriveFile,
  },
  save_to_drive: {
    schema: {
      type: "function",
      function: {
        name: "save_to_drive",
        description:
          "Save content as a new file in the user's Google Drive — e.g. a draft, report, notes, or a summary they " +
          "asked to keep. Defaults to Markdown. Use when they ask to save something to Drive.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "File name, e.g. \"Physics Notes.md\"." },
            content: { type: "string", description: "The file's text content." },
            mime_type: { type: "string", description: "MIME type (default text/markdown; e.g. text/plain, text/csv)." },
          },
          required: ["name", "content"],
        },
      },
    },
    label: (a) => `Saving “${String(a.name ?? "file").slice(0, 60)}” to Drive`,
    run: saveToDrive,
  },
  manage_gmail: {
    schema: {
      type: "function",
      function: {
        name: "manage_gmail",
        description:
          "Test or disconnect the user's Gmail connection — right from chat. Use 'test' when they ask if email/Gmail " +
          "is working or set up, or after a send fails, to check the connection; 'disconnect' to remove it. " +
          "Connecting Gmail is NOT done from chat — if it isn't connected, tell the user to connect it from Settings.",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["test", "disconnect"], description: "What to do." },
          },
          required: ["action"],
        },
      },
    },
    label: (a) => `Gmail: ${a.action === "test" ? "testing connection" : "disconnecting"}`,
    run: manageGmail,
  },
  control_ui: {
    schema: {
      type: "function",
      function: {
        name: "control_ui",
        description:
          "Change the app's settings/appearance for the user, right from chat: night mode (warm dim ambience), " +
          "focus mode (optionally with a level), ambient study sound, and the persistent Auto Night / Auto Morning " +
          "preferences. Use whenever the user asks to change the look, dim the screen, enable/exit focus, play or " +
          "stop the study sound, or turn the automatic evening/morning ambience on or off.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["night", "focus", "ambient_sound", "auto_night", "auto_morning"],
              description: "Which setting to change.",
            },
            value: { type: "string", enum: ["on", "off"], description: "Turn it on or off." },
            level: {
              type: "string",
              enum: ["light", "deep", "study"],
              description: "Focus depth — only with action=focus.",
            },
          },
          required: ["action", "value"],
        },
      },
    },
    label: (a) => `Turning ${String(a.action ?? "setting").replace(/_/g, " ")} ${a.value === "off" ? "off" : "on"}`,
    run: controlUi,
  },
  remember: {
    schema: {
      type: "function",
      function: {
        name: "remember",
        description:
          "Save a durable fact about the user to long-term memory so you recall it in FUTURE chats: a stable " +
          "preference (how they like answers, tone), a goal or ongoing project, their name/role, or an important " +
          "detail they volunteer. Call it the moment such a fact appears. Do NOT save transient chit-chat, one-off " +
          "task specifics, things already in memory, or anything sensitive they didn't clearly choose to share.",
        parameters: {
          type: "object",
          properties: {
            fact: {
              type: "string",
              description:
                'The fact, concise and in third person — e.g. "Prefers short, direct answers" or "Is building a React study app called Simplicity".',
            },
          },
          required: ["fact"],
        },
      },
    },
    label: (a) => `Remembering: ${String(a.fact ?? "").slice(0, 56)}`,
    run: remember,
  },
  spawn_agents: {
    schema: {
      type: "function",
      function: {
        name: "spawn_agents",
        description:
          "Delegate a BIG, multi-part task to a team of focused sub-agents that run in parallel. " +
          "YOU decide how many to spawn (1–3), name each one, set its `kind`, and give each a clear, " +
          "self-contained task. Use this for work that splits into independent parts — e.g. research with " +
          "several angles, or a build that needs both a document and an app. Each sub-agent has real tools: " +
          "research agents search the web, writer agents produce documents, coder agents build apps. " +
          "After they finish you will receive their results to synthesize.",
        parameters: {
          type: "object",
          properties: {
            agents: {
              type: "array",
              description: "The sub-agents to spawn (1–3).",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "A short name, e.g. \"Market Researcher\" or \"UI Builder\"." },
                  kind: {
                    type: "string",
                    enum: ["research", "writer", "coder", "general"],
                    description:
                      "The agent's specialty: research (web search), writer (documents), coder (build apps), or general.",
                  },
                  task: { type: "string", description: "The specific, self-contained task for this sub-agent." },
                },
                required: ["name", "task"],
              },
            },
          },
          required: ["agents"],
        },
      },
    },
    label: (a) => {
      const n = Array.isArray(a.agents) ? a.agents.length : 0
      return `Spawning ${n} sub-agent${n === 1 ? "" : "s"}`
    },
    run: spawnAgents,
  },
}

export const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => t.schema)

// Tools available to sub-agents — a versatile subset so a team can actually
// produce deliverables (research, documents, apps). Deliberately excludes
// spawn_agents (no recursion) and update_draft (revision is a parent concern).
const SUBAGENT_TOOLS: Record<string, AgentTool> = {
  web_search: TOOLS.web_search,
  get_datetime: TOOLS.get_datetime,
  create_draft: TOOLS.create_draft,
  build_app: TOOLS.build_app,
}
const SUBAGENT_TOOL_SCHEMAS = Object.values(SUBAGENT_TOOLS).map((t) => t.schema)
