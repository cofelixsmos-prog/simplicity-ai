// Shared hardening helpers for API route handlers: CORS, client IP, in-memory
// rate limiting, and timed fetches. Tuned for a single-instance deploy.

// ── CORS ────────────────────────────────────────────────────────────────────
// Origins allowed to call the API cross-origin. Configure via ALLOWED_ORIGINS
// (comma-separated); same-origin requests never need CORS. Use "*" to allow all.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

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
interface Bucket {
  count: number
  reset: number
}
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) }
  b.count++
  return { ok: true, retryAfter: 0 }
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
