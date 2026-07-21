import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { listHarnessRequests, setHarnessAccess, setHarnessRequestStatus } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// List all access requests. Admin only.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  if (!user.isAdmin) return jsonResponse({ error: "Forbidden" }, { status: 403 }, req)
  return jsonResponse({ requests: await listHarnessRequests() }, { status: 200 }, req)
}

// Grant or revoke access, and mark the request approved/denied. Admin only.
// Body: { userId, requestId?, action: "approve" | "deny" | "revoke" }
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  if (!user.isAdmin) return jsonResponse({ error: "Forbidden" }, { status: 403 }, req)

  let body: { userId?: string; requestId?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const userId = String(body.userId ?? "")
  const action = String(body.action ?? "")
  if (!userId) return jsonResponse({ error: "Missing userId." }, { status: 400 }, req)

  if (action === "approve") {
    await setHarnessAccess(userId, true)
    if (body.requestId) await setHarnessRequestStatus(String(body.requestId), "approved")
  } else if (action === "deny") {
    await setHarnessAccess(userId, false)
    if (body.requestId) await setHarnessRequestStatus(String(body.requestId), "denied")
  } else if (action === "revoke") {
    await setHarnessAccess(userId, false)
  } else {
    return jsonResponse({ error: "Unknown action." }, { status: 400 }, req)
  }

  return jsonResponse({ ok: true }, { status: 200 }, req)
}
