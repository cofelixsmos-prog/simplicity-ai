import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { getAutomation, getAutomationEvent, setAutomationEventStatus, addAutomationEvent } from "@/lib/db/repo"
import { executeApprovedReply } from "@/lib/automations/engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Approve or deny a pending action (approval-mode automations queue actions
// here instead of executing them directly).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  const a = await getAutomation(id, user.id)
  if (!a) return jsonResponse({ error: "Not found" }, { status: 404 }, req)

  let body: { eventId?: string; approve?: boolean }
  try { body = await req.json() } catch { return jsonResponse({ error: "Invalid body" }, { status: 400 }, req) }
  const eventId = String(body.eventId ?? "")
  const approve = body.approve !== false

  const ev = await getAutomationEvent(eventId)
  if (!ev || ev.automationId !== id || ev.userId !== user.id)
    return jsonResponse({ error: "Event not found" }, { status: 404 }, req)
  if (ev.status !== "pending")
    return jsonResponse({ error: "Already handled" }, { status: 409 }, req)

  if (!approve) {
    await setAutomationEventStatus(eventId, "skipped", `Denied: ${ev.title.replace(/^Reply ready for approval — /, "Reply to ")}`)
    return jsonResponse({ ok: true, status: "denied" }, { status: 200 }, req)
  }

  const detail = (() => { try { return JSON.parse(ev.detail ?? "{}") } catch { return {} } })() as {
    to?: string; subject?: string; body?: string
  }
  if (detail.to && detail.body) {
    const ok = await executeApprovedReply(a, detail.to, detail.subject || "(no subject)", detail.body)
    await setAutomationEventStatus(eventId, ok ? "success" : "error", ok ? `Replied to ${detail.to}` : `Approval failed for ${detail.to}`)
    if (ok) {
      await addAutomationEvent({
        automationId: id, userId: user.id, kind: "reply",
        title: `Reply sent to ${detail.to} (approved)`, status: "success",
      })
    }
    return jsonResponse({ ok, status: ok ? "sent" : "failed" }, { status: 200 }, req)
  }

  await setAutomationEventStatus(eventId, "skipped", "Nothing to execute")
  return jsonResponse({ ok: true, status: "empty" }, { status: 200 }, req)
}
