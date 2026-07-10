import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { deleteConversation, getConversation, listMessages, renameConversation, setConversationPinned } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  const conversation = await getConversation(id, user.id)
  if (!conversation) return jsonResponse({ error: "Not found" }, { status: 404 }, req)
  const messages = await listMessages(id)
  return jsonResponse({ conversation, messages }, { status: 200 }, req)
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  if (!(await getConversation(id, user.id))) return jsonResponse({ error: "Not found" }, { status: 404 }, req)
  let body: { title?: string; pinned?: boolean }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid body" }, { status: 400 }, req)
  }
  if (typeof body.pinned === "boolean") {
    await setConversationPinned(id, user.id, body.pinned)
    return jsonResponse({ ok: true }, { status: 200 }, req)
  }
  const title = String(body.title ?? "").trim().slice(0, 200)
  if (!title) return jsonResponse({ error: "Title required" }, { status: 400 }, req)
  await renameConversation(id, user.id, title)
  return jsonResponse({ ok: true }, { status: 200 }, req)
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  await deleteConversation(id, user.id)
  return jsonResponse({ ok: true }, { status: 200 }, req)
}
