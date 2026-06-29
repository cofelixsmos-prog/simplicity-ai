import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { addMessage, getConversation } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CONTENT = 100_000

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Append a message to a conversation the user owns.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  if (!(await getConversation(id, user.id))) return jsonResponse({ error: "Not found" }, { status: 404 }, req)

  let body: { role?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid body" }, { status: 400 }, req)
  }
  const role = body.role === "assistant" ? "assistant" : body.role === "user" ? "user" : null
  const content = typeof body.content === "string" ? body.content : ""
  if (!role || !content.trim()) return jsonResponse({ error: "role and content required" }, { status: 400 }, req)

  const message = await addMessage(id, role, content.slice(0, MAX_CONTENT))
  return jsonResponse({ message }, { status: 201 }, req)
}
