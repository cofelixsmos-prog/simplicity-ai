import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Returns { user } or { user: null } (200 either way, so the client can branch easily).
export async function GET(req: Request) {
  const user = await getCurrentUser()
  return jsonResponse({ user }, { status: 200 }, req)
}
