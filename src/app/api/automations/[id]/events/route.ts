import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { getAutomation, listAutomationEvents } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  const a = await getAutomation(id, user.id)
  if (!a) return jsonResponse({ error: "Not found" }, { status: 404 }, req)

  const rows = await listAutomationEvents(id, 150)
  const events = rows.map((e) => ({
    id: e.id,
    ts: e.ts,
    kind: e.kind,
    title: e.title,
    status: e.status,
    detail: e.detail ? (() => { try { return JSON.parse(e.detail!) } catch { return null } })() : null,
  }))
  return jsonResponse({ events }, { status: 200 }, req)
}
