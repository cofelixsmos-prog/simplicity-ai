import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { listUserArtifacts } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Every reopenable artifact (apps, drafts) the user has made, across all chats.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  return jsonResponse({ artifacts: await listUserArtifacts(user.id) }, { status: 200 }, req)
}
