import { jsonResponse, preflight } from "@/lib/api/http"
import { endSession } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  await endSession()
  return jsonResponse({ ok: true }, { status: 200 }, req)
}
