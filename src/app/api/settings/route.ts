import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { setUserSettings, setUserSystemPrompt, setUserName } from "@/lib/db/repo"
import { parseSettings, serializeSettings, MAX_SYSTEM_PROMPT } from "@/lib/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      systemPrompt: user.systemPrompt,
      settings: parseSettings(user.settings),
      gmailAddress: user.gmailAddress,
      gmailConnected: user.gmailConnected,
    },
  }, { status: 200 }, req)
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid body" }, { status: 400 }, req)
  }

  if (typeof body.name === "string") {
    await setUserName(user.id, body.name.trim().slice(0, 100))
  }

  if (body.systemPrompt !== undefined) {
    const sp = typeof body.systemPrompt === "string"
      ? body.systemPrompt.trim().slice(0, MAX_SYSTEM_PROMPT) || null
      : null
    await setUserSystemPrompt(user.id, sp)
  }

  if (body.settings && typeof body.settings === "object") {
    const current = parseSettings(user.settings)
    const patch = body.settings as Record<string, unknown>
    if (typeof patch.autoNight === "boolean") current.autoNight = patch.autoNight
    if (typeof patch.autoMorning === "boolean") current.autoMorning = patch.autoMorning
    if (typeof patch.dimDelay === "number") current.dimDelay = Math.max(0, Math.min(120, patch.dimDelay))
    if (typeof patch.dimOpacity === "number") current.dimOpacity = Math.max(0, Math.min(1, patch.dimOpacity))
    if (typeof patch.focusDimOpacity === "number") current.focusDimOpacity = Math.max(0, Math.min(1, patch.focusDimOpacity))
    if (typeof patch.animSpeed === "number") current.animSpeed = Math.max(0, Math.min(2, patch.animSpeed))
    if (typeof patch.focusAnimSpeed === "number") current.focusAnimSpeed = Math.max(0, Math.min(2, patch.focusAnimSpeed))
    await setUserSettings(user.id, serializeSettings(current))
  }

  return jsonResponse({ ok: true }, { status: 200 }, req)
}
