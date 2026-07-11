// Shared hardening helpers for API route handlers: CORS, client IP, in-memory
// rate limiting, and timed fetches. Tuned for a single-instance deploy.

// ── CORS ────────────────────────────────────────────────────────────────────
// Origins allowed to call the API cross-origin. Configure via ALLOWED_ORIGINS
// (comma-separated); same-origin requests never need CORS. Use "*" to allow all.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

if (process.env.NODE_ENV === "production" && ALLOWED_ORIGINS.includes("*")) {
  // A wildcard origin in production would let any website's JS call every API
  // route as the visiting browser — refuse to boot rather than allow it silently.
  throw new Error('ALLOWED_ORIGINS="*" is not allowed in production. List explicit origins instead.')
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin")
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
  if (origin && (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin))) {
    headers["Access-Control-Allow-Origin"] = origin
  }
  return headers
}

// Preflight (OPTIONS) responder.
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// JSON response that carries CORS headers.
export function jsonResponse(data: unknown, init: ResponseInit, req: Request): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
      ...(init.headers ?? {}),
    },
  })
}

// ── Client IP (behind Render / proxies) ─────────────────────────────────────
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

// ── Rate limiting (fixed window, in-memory) ─────────────────────────────────
// NOTE: buckets live in process memory, so limits reset on restart/redeploy and
// don't share state across multiple instances. Fine for a single small
// instance; if this app ever runs more than one instance, back this with a
// shared store (Redis/Upstash/Turso) instead — the key/limit/window shape
// here would carry over unchanged.
interface Bucket {
  count: number
  reset: number
}
const buckets = new Map<string, Bucket>()

function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number; count: number } {
  const now = Date.now()
  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0, count: 1 }
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000), count: b.count }
  b.count++
  return { ok: true, retryAfter: 0, count: b.count }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  return hit(key, limit, windowMs)
}

// Prefer the authenticated user's id as the rate-limit key; only fall back to
// IP for anonymous routes (register/login before a session exists). A shared
// office/NAT IP or a rotated-IP attacker both land on the right bucket this way
// instead of every logged-in user on one IP fighting over a single IP-keyed budget.
export function rateLimitKey(prefix: string, req: Request, userId?: string | null): string {
  return userId ? `${prefix}:u:${userId}` : `${prefix}:ip:${clientIp(req)}`
}

export interface TierResult {
  ok: boolean // hard limit — reject the request
  soft: boolean // soft limit crossed — allow it, but caller may warn/degrade
  retryAfter: number
}

// Two-window limiter: a tight "burst" window catches rapid-fire abuse, a wider
// "sustained" window catches slow-drip abuse that would sneak under the burst
// cap. A separate, lower "soft" threshold on the sustained window lets callers
// degrade gracefully (e.g. add a short delay, drop to a cheaper model) before
// hitting the hard wall — most legitimate heavy users hit soft, not hard.
export function tieredRateLimit(
  key: string,
  opts: { burst: number; burstWindowMs: number; sustained: number; sustainedWindowMs: number; soft?: number }
): TierResult {
  const b = hit(`${key}:burst`, opts.burst, opts.burstWindowMs)
  if (!b.ok) return { ok: false, soft: true, retryAfter: b.retryAfter }

  const s = hit(`${key}:sustained`, opts.sustained, opts.sustainedWindowMs)
  if (!s.ok) return { ok: false, soft: true, retryAfter: s.retryAfter }

  const soft = opts.soft !== undefined && s.count > opts.soft
  return { ok: true, soft, retryAfter: 0 }
}

// ── Timed non-streaming POST → parsed JSON (aborts on timeout) ───────────────
export async function fetchJsonWithTimeout(url: string, init: RequestInit, ms: number): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}
