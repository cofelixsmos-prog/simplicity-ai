import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { getAutomation, updateAutomation, deleteAutomation, addAutomationEvent } from "@/lib/db/repo"
import { serialize } from "../route"

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
  return jsonResponse({ automation: serialize(a) }, { status: 200 }, req)
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  const existing = await getAutomation(id, user.id)
  if (!existing) return jsonResponse({ error: "Not found" }, { status: 404 }, req)

  let body: {
    status?: string
    name?: string
    permissions?: Record<string, Record<string, boolean>>
    config?: { approvalMode?: boolean; rateLimitPerHour?: number; digestHour?: number | null }
  }
  try { body = await req.json() } catch { return jsonResponse({ error: "Invalid body" }, { status: 400 }, req) }

  const patch: Record<string, string> = {}
  if (body.name) patch.name = body.name.slice(0, 80)
  if (body.permissions) patch.permissions = JSON.stringify(body.permissions)
  if (body.config) {
    // Preserve digestHour (schedule) unless the caller explicitly changes it.
    const prev = (() => { try { return JSON.parse(existing.config) as { digestHour?: number | null } } catch { return {} } })()
    const dh = body.config.digestHour !== undefined ? body.config.digestHour : (prev.digestHour ?? null)
    patch.config = JSON.stringify({
      approvalMode: !!body.config.approvalMode,
      rateLimitPerHour: Number(body.config.rateLimitPerHour) || 20,
      digestHour: typeof dh === "number" ? dh : null,
    })
  }

  let activating = false
  if (body.status && ["running", "paused", "draft"].includes(body.status)) {
    patch.status = body.status
    activating = body.status === "running" && existing.status !== "running"
  }

  await updateAutomation(id, user.id, patch)

  if (activating) {
    await addAutomationEvent({
      automationId: id, userId: user.id, kind: "system",
      title: "Automation activated — now running 24/7.", status: "success",
    })
  } else if (body.status === "paused" && existing.status === "running") {
    await addAutomationEvent({
      automationId: id, userId: user.id, kind: "system",
      title: "Automation paused.", status: "success",
    })
  }

  const updated = await getAutomation(id, user.id)
  return jsonResponse({ automation: updated ? serialize(updated) : null }, { status: 200 }, req)
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  await deleteAutomation(id, user.id)
  return jsonResponse({ ok: true }, { status: 200 }, req)
}
