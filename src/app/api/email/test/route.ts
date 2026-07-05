import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUserRow } from "@/lib/auth"
import { verifyGmail } from "@/lib/email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// "Test Connection" — verifies the stored App Password logs in, without sending.
export async function POST(req: Request) {
  const rl = rateLimit(`emailtest:${clientIp(req)}`, 6, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many attempts. Try again shortly." }, { status: 429 }, req)

  const user = await getCurrentUserRow()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const result = await verifyGmail(user)
  return jsonResponse(result, { status: 200 }, req)
}
