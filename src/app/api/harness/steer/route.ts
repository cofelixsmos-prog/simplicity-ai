import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { pushSteer } from "@/lib/harness/steer-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Send a live steering message into an in-progress run ("focus on EV funds, not
// the market", "dig deeper on Elon Musk"). The run picks it up on its next phase
// boundary and adds/removes agents accordingly.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  if (!user.harnessAccess) return jsonResponse({ error: "Harness is invite-only." }, { status: 403 }, req)

  let body: { runId?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }
  const runId = String(body.runId ?? "")
  const message = String(body.message ?? "").trim()
  if (!runId || !message) return jsonResponse({ error: "Missing runId or message." }, { status: 400 }, req)

  const ok = pushSteer(runId, message)
  if (!ok) return jsonResponse({ error: "That run is no longer active." }, { status: 404 }, req)
  return jsonResponse({ ok: true }, { status: 200 }, req)
}
