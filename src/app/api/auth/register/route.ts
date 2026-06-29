import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { hashPassword, startSession } from "@/lib/auth"
import { createUser, getUserByEmail } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  const rl = rateLimit(`register:${clientIp(req)}`, 8, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many attempts. Try again shortly." }, { status: 429 }, req)

  let body: { email?: string; password?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  const name = body.name ? String(body.name).trim().slice(0, 80) : undefined

  if (!EMAIL_RE.test(email)) return jsonResponse({ error: "Enter a valid email address." }, { status: 400 }, req)
  if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters." }, { status: 400 }, req)
  if (await getUserByEmail(email)) return jsonResponse({ error: "An account with that email already exists." }, { status: 409 }, req)

  const user = await createUser(email, await hashPassword(password), name)
  await startSession(user.id)
  return jsonResponse({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 }, req)
}
