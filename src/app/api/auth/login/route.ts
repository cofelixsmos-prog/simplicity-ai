import { jsonResponse, preflight, clientIp, tieredRateLimit } from "@/lib/api/http"
import { startSession, verifyPassword, MAX_PASSWORD_LEN } from "@/lib/auth"
import { getUserByEmail } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  // Two independent limits: per-IP (stops one attacker hammering many accounts
  // from one machine) and per-account below (stops credential stuffing spread
  // across many IPs at one target account). Each is itself burst+sustained.
  const rlIp = tieredRateLimit(`login:ip:${clientIp(req)}`, {
    burst: 10,
    burstWindowMs: 60_000,
    sustained: 40,
    sustainedWindowMs: 60 * 60_000,
  })
  if (!rlIp.ok) return jsonResponse({ error: "Too many attempts. Try again shortly." }, { status: 429 }, req)

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 320)
  const password = String(body.password ?? "")
  if (password.length > MAX_PASSWORD_LEN) {
    return jsonResponse({ error: "Invalid email or password." }, { status: 401 }, req)
  }

  // Per-account throttle on top of the per-IP one, so a distributed attacker
  // can't hammer a single mailbox from many IPs. Counts every attempt; a
  // legitimate user hitting it just waits out the window.
  const rlAccount = tieredRateLimit(`login-acct:${email}`, {
    burst: 15,
    burstWindowMs: 15 * 60_000,
    sustained: 30,
    sustainedWindowMs: 6 * 60 * 60_000,
  })
  if (!rlAccount.ok) {
    return jsonResponse({ error: "Too many attempts for this account. Try again in a few minutes." }, { status: 429 }, req)
  }

  const user = await getUserByEmail(email)
  // Same response whether the email or password is wrong (no account enumeration).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return jsonResponse({ error: "Invalid email or password." }, { status: 401 }, req)
  }

  await startSession(user.id)
  return jsonResponse({ user: { id: user.id, email: user.email, name: user.name } }, { status: 200 }, req)
}
