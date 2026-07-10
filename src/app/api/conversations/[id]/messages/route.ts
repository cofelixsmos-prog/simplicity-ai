import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { addMessage, getConversation, updateMessageArtifacts } from "@/lib/db/repo"

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

  let body: { role?: string; content?: string; artifacts?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid body" }, { status: 400 }, req)
  }
  const role = body.role === "assistant" ? "assistant" : body.role === "user" ? "user" : null
  const content = typeof body.content === "string" ? body.content : ""
  if (!role || !content.trim()) return jsonResponse({ error: "role and content required" }, { status: 400 }, req)

  // Reopenable artifacts (apps/drafts) + attachment refs as JSON, so the chat
  // restores them on reload. Capped to keep a runaway blob out of the row.
  let artifacts: string | null = null
  if (body.artifacts && typeof body.artifacts === "object") {
    const s = JSON.stringify(body.artifacts)
    if (s.length <= 600_000) artifacts = s
  }

  const message = await addMessage(id, role, content.slice(0, MAX_CONTENT), artifacts)
  return jsonResponse({ message }, { status: 201 }, req)
}

// Update artifacts on an existing message (e.g. marking an email as sent).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  if (!(await getConversation(id, user.id))) return jsonResponse({ error: "Not found" }, { status: 404 }, req)

  let body: { index?: number; artifacts?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid body" }, { status: 400 }, req)
  }
  if (typeof body.index !== "number" || !body.artifacts || typeof body.artifacts !== "object")
    return jsonResponse({ error: "index and artifacts required" }, { status: 400 }, req)

  const s = JSON.stringify(body.artifacts)
  if (s.length > 600_000) return jsonResponse({ error: "Artifacts too large" }, { status: 400 }, req)

  const ok = await updateMessageArtifacts(id, body.index, s)
  return jsonResponse({ ok }, { status: ok ? 200 : 404 }, req)
}
