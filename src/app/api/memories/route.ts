import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { listMemories, deleteMemory, clearMemories } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// List everything the assistant has remembered about the signed-in user.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  return jsonResponse({ memories: await listMemories(user.id) }, { status: 200 }, req)
}

// Delete one memory (?id=…) or clear them all (?all=1).
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const url = new URL(req.url)
  if (url.searchParams.get("all") === "1") {
    await clearMemories(user.id)
    return jsonResponse({ ok: true }, { status: 200 }, req)
  }
  const id = url.searchParams.get("id")
  if (!id) return jsonResponse({ error: "Missing id" }, { status: 400 }, req)
  await deleteMemory(id, user.id)
  return jsonResponse({ ok: true }, { status: 200 }, req)
}
