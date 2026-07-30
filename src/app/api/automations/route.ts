import { jsonResponse, preflight, rateLimit, rateLimitKey } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { createAutomation, listAutomations, updateAutomation, getAutomation } from "@/lib/db/repo"
import { planAutomation } from "@/lib/automations/engine"
import type { Automation } from "@/lib/db/schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Shape an Automation row into a client-friendly object (parsed JSON fields).
export function serialize(a: Automation) {
  const safe = <T,>(s: string, fallback: T): T => { try { return JSON.parse(s) as T } catch { return fallback } }
  return {
    id: a.id,
    name: a.name,
    prompt: a.prompt,
    workflow: safe<string[]>(a.workflow, []),
    services: safe<string[]>(a.services, []),
    permissions: safe<Record<string, Record<string, boolean>>>(a.permissions, {}),
    config: safe<{ approvalMode: boolean; rateLimitPerHour: number; digestHour: number | null }>(a.config, { approvalMode: false, rateLimitPerHour: 20, digestHour: null }),
    status: a.status,
    stats: safe<Record<string, number>>(a.stats, {}),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    lastRunAt: a.lastRunAt,
    lastActionAt: a.lastActionAt,
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const rows = await listAutomations(user.id)
  return jsonResponse({ automations: rows.map(serialize) }, { status: 200 }, req)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const rl = rateLimit(rateLimitKey("automations", req, user.id), 20, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests" }, { status: 429 }, req)

  let body: {
    prompt?: string
    activate?: boolean
    // A finalized plan from the in-chat review card (permissions already edited).
    plan?: {
      name?: string
      workflow?: string[]
      services?: string[]
      permissions?: Record<string, Record<string, boolean>>
      config?: { approvalMode?: boolean; rateLimitPerHour?: number; digestHour?: number | null }
    }
  }
  try { body = await req.json() } catch { return jsonResponse({ error: "Invalid body" }, { status: 400 }, req) }
  const prompt = String(body.prompt ?? "").trim()
  if (!prompt) return jsonResponse({ error: "Describe what you want the automation to do." }, { status: 400 }, req)

  // Use the reviewed plan if the client sends one (from the chat card); otherwise
  // generate it from natural language.
  const p = body.plan
  const plan = p && Array.isArray(p.workflow) && p.permissions
    ? {
        name: String(p.name ?? "Automation").slice(0, 60),
        workflow: p.workflow.map(String).slice(0, 8),
        services: Array.isArray(p.services) ? p.services.map(String) : ["gmail"],
        permissions: p.permissions,
        config: {
          approvalMode: !!p.config?.approvalMode,
          rateLimitPerHour: Number(p.config?.rateLimitPerHour) || 20,
          digestHour: typeof p.config?.digestHour === "number" ? p.config.digestHour : null,
        },
      }
    : await planAutomation(prompt)

  const row = await createAutomation({
    userId: user.id,
    name: plan.name,
    prompt,
    workflow: plan.workflow,
    services: plan.services,
    permissions: plan.permissions,
    config: plan.config,
  })
  // Activate immediately when the user accepted the card.
  if (body.activate) await updateAutomation(row.id, user.id, { status: "running" })
  const final = await getAutomation(row.id, user.id)
  return jsonResponse({ automation: serialize(final ?? row) }, { status: 201 }, req)
}
