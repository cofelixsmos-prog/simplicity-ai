import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUserRow } from "@/lib/auth"
import { trashMessages, friendlyImapError } from "@/lib/imap"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Move the given email ids (uids) to Gmail Trash. Called only from the
// confirmation card after the user clicks — the AI never reaches this directly.
export async function POST(req: Request) {
  const rl = rateLimit(`emaildel:${clientIp(req)}`, 12, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests. Slow down a moment." }, { status: 429 }, req)

  const user = await getCurrentUserRow()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  if (!user.gmailAppPassword) return jsonResponse({ error: "Gmail isn't connected." }, { status: 400 }, req)

  let body: { ids?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.map((n) => Number(n)).filter((n) => Number.isFinite(n)).slice(0, 200)
    : []
  if (ids.length === 0) return jsonResponse({ error: "No emails to delete." }, { status: 400 }, req)

  try {
    const trashed = await trashMessages(user, ids)
    return jsonResponse({ trashed }, { status: 200 }, req)
  } catch (e) {
    return jsonResponse({ error: friendlyImapError(e) }, { status: 502 }, req)
  }
}
