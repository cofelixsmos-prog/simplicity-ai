import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { createConversation, listConversations } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  return jsonResponse({ conversations: await listConversations(user.id) }, { status: 200 }, req)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  let body: { title?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const title = String(body.title ?? "New chat").trim().slice(0, 200) || "New chat"
  const conversation = await createConversation(user.id, title)
  return jsonResponse({ conversation }, { status: 201 }, req)
}
