import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { startSession, verifyPassword, MAX_PASSWORD_LEN } from "@/lib/auth"
import { getUserByEmail } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many attempts. Try again shortly." }, { status: 429 }, req)

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
  const rlAccount = rateLimit(`login-acct:${email}`, 15, 15 * 60_000)
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
