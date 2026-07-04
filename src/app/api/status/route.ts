import { corsHeaders, jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Real, cheap health for the models/services behind Simplicity. We hit each
// provider's `/models` endpoint (auth + reachability, zero token cost) rather
// than running a completion, and cache the result briefly so the status board's
// polling can't hammer the upstreams.

type Health = "operational" | "degraded" | "down" | "unconfigured"

const PROVIDERS = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", envKey: "GROQ_API_KEY" },
  opencode: { url: "https://opencode.ai/zen/v1/chat/completions", envKey: "OPENCODE_API_KEY" },
} as const

interface Probe {
  status: Health
  latency: number | null // round-trip ms of the reachability check
}

async function probe(prov: { url: string; envKey: string }): Promise<Probe> {
  const key = process.env[prov.envKey]
  if (!key) return { status: "unconfigured", latency: null }
  const url = prov.url.replace(/\/chat\/completions$/, "/models")
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 4500)
  const t0 = Date.now()
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: ctrl.signal })
    const latency = Date.now() - t0
    if (r.ok) return { status: "operational", latency }
    if (r.status === 429) return { status: "degraded", latency } // rate-limited but alive
    return { status: "down", latency } // bad key / server error
  } catch {
    return { status: "down", latency: null } // timeout / unreachable
  } finally {
    clearTimeout(to)
  }
}

interface StatusPayload {
  overall: Health
  services: { id: string; label: string; role: string; status: Health; latency: number | null }[]
  checkedAt: number
}

let cache: { at: number; data: StatusPayload } | null = null
const TTL = 12_000

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function GET(req: Request) {
  const rl = rateLimit(`status:${clientIp(req)}`, 60, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests." }, { status: 429 }, req)

  if (cache && Date.now() - cache.at < TTL) {
    return jsonResponse(cache.data, { status: 200 }, req)
  }

  const [groq, opencode] = await Promise.all([probe(PROVIDERS.groq), probe(PROVIDERS.opencode)])
  const search: Health =
    process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX ? "operational" : "unconfigured"

  const services = [
    { id: "r1", label: "R1", role: "reasoning", status: groq.status, latency: groq.latency },
    { id: "a1", label: "A1", role: "fast", status: groq.status, latency: groq.latency },
    { id: "d1", label: "D1", role: "coder", status: opencode.status, latency: opencode.latency },
    { id: "search", label: "Search", role: "web", status: search, latency: null },
  ]

  const live = services.filter((s) => s.status !== "unconfigured")
  const overall: Health = live.every((s) => s.status === "operational")
    ? "operational"
    : live.every((s) => s.status === "down")
      ? "down"
      : "degraded"

  const data: StatusPayload = { overall, services, checkedAt: Date.now() }
  cache = { at: Date.now(), data }
  return jsonResponse(data, { status: 200, headers: corsHeaders(req) }, req)
}
