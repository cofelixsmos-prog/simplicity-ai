import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUserRow } from "@/lib/auth"
import { getUpload } from "@/lib/db/repo"
import { getGmailTransport, sendVia, EMAIL_RE, type OutgoingEmail, type EmailFile } from "@/lib/email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Hardening limits.
const MAX_EMAILS = 200
const MAX_SUBJECT = 300
const MAX_BODY = 50_000
// Batch-safety thresholds — beyond these, a typed confirmation token is required
// (defense against a runaway/misunderstood "send all").
const BULK_COUNT = 25
const BULK_EXTERNAL = 10
const MAX_ATTACH_BYTES = 25 * 1024 * 1024 // Gmail's total-message ceiling

export function OPTIONS(req: Request) {
  return preflight(req)
}

interface InEmail {
  to?: unknown
  subject?: unknown
  body?: unknown
  cc?: unknown
  bcc?: unknown
  attachments?: unknown
}

export async function POST(req: Request) {
  const rl = rateLimit(`email:${clientIp(req)}`, 12, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many send requests. Slow down a moment." }, { status: 429 }, req)

  const user = await getCurrentUserRow()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const t = getGmailTransport(user)
  if (!t) return jsonResponse({ error: "Gmail isn't connected. Add an App Password in settings first." }, { status: 400 }, req)

  let body: { emails?: InEmail[]; confirm?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const rawEmails = Array.isArray(body.emails) ? body.emails : []
  if (rawEmails.length === 0) return jsonResponse({ error: "No emails to send." }, { status: 400 }, req)
  if (rawEmails.length > MAX_EMAILS)
    return jsonResponse({ error: `Too many emails at once (max ${MAX_EMAILS}).` }, { status: 413 }, req)

  // Normalize + validate every email up front — reject the whole batch on any
  // malformed recipient so a typo can't cause a partial, confusing send.
  // Resolve attachment ids to bytes once (an id may be reused across a batch),
  // enforcing per-user ownership and a total-size ceiling.
  const fileCache = new Map<string, EmailFile>()
  let totalAttachBytes = 0

  const emails: OutgoingEmail[] = []
  for (const e of rawEmails) {
    const to = String(e.to ?? "").trim().toLowerCase()
    const subject = String(e.subject ?? "").trim().slice(0, MAX_SUBJECT)
    const emailBody = String(e.body ?? "").slice(0, MAX_BODY)
    if (!EMAIL_RE.test(to))
      return jsonResponse({ error: `"${to || "(blank)"}" is not a valid email address.` }, { status: 400 }, req)
    if (!subject && !emailBody)
      return jsonResponse({ error: `The email to ${to} is empty.` }, { status: 400 }, req)

    // Attachment ids → owned file bytes.
    const attIds = Array.isArray(e.attachments)
      ? (e.attachments as unknown[])
          .map((a) => (typeof a === "string" ? a : (a as { id?: unknown })?.id))
          .filter((x): x is string => typeof x === "string")
      : []
    let files: EmailFile[] | undefined
    for (const id of attIds) {
      let file = fileCache.get(id)
      if (!file) {
        const row = await getUpload(id, user.id)
        if (!row) return jsonResponse({ error: "An attachment is missing or expired — re-upload and try again." }, { status: 400 }, req)
        const buf = Buffer.from(row.data, "base64")
        totalAttachBytes += buf.byteLength
        if (totalAttachBytes > MAX_ATTACH_BYTES)
          return jsonResponse({ error: "Attachments exceed the 25MB total limit." }, { status: 413 }, req)
        file = { filename: row.name, content: buf, contentType: row.mime }
        fileCache.set(id, file)
      }
      ;(files ??= []).push(file)
    }
    emails.push({ to, subject, body: emailBody, attachments: files })
  }

  // Batch-safety gate: large sends, or many recipients outside the sender's own
  // domain, require the client to echo back a typed confirmation token.
  const senderDomain = t.from.split("@")[1]?.toLowerCase() ?? ""
  const externalCount = emails.filter((e) => e.to.split("@")[1]?.toLowerCase() !== senderDomain).length
  const needsConfirm = emails.length > BULK_COUNT || externalCount > BULK_EXTERNAL
  const confirmToken = `SEND ${emails.length}`
  if (needsConfirm && String(body.confirm ?? "").trim().toUpperCase() !== confirmToken.toUpperCase()) {
    t.transport.close()
    return jsonResponse(
      {
        needConfirm: true,
        confirmToken,
        count: emails.length,
        external: externalCount,
      },
      { status: 200 },
      req
    )
  }

  // Send sequentially so one Gmail connection is reused and rate stays sane.
  const results: { to: string; ok: boolean; error?: string }[] = []
  for (const email of emails) {
    const r = await sendVia(t.transport, t.from, email)
    results.push({ to: email.to, ok: r.ok, error: r.error })
  }
  t.transport.close()

  const sent = results.filter((r) => r.ok).length
  return jsonResponse({ sent, failed: results.length - sent, results }, { status: 200 }, req)
}
