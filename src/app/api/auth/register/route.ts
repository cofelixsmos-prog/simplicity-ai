import { jsonResponse, preflight, clientIp, tieredRateLimit } from "@/lib/api/http"
import { hashPassword, startSession, MAX_PASSWORD_LEN } from "@/lib/auth"
import { createUser, getUserByEmail } from "@/lib/db/repo"
import { MAX_SYSTEM_PROMPT, parseSettings, serializeSettings } from "@/lib/settings"
import { encryptSecret } from "@/lib/crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  // No account exists yet at this point, so this can only be keyed by IP.
  // Tight burst window stops rapid scripted signups; a wider sustained window
  // (lower per-window rate) catches a slow-drip bot spread out to look human.
  const rl = tieredRateLimit(`register:ip:${clientIp(req)}`, {
    burst: 8,
    burstWindowMs: 60_000,
    sustained: 20,
    sustainedWindowMs: 60 * 60_000,
  })
  if (!rl.ok) return jsonResponse({ error: "Too many attempts. Try again shortly." }, { status: 429 }, req)

  let body: {
    email?: string
    password?: string
    name?: string
    systemPrompt?: string
    settings?: { autoNight?: boolean; autoMorning?: boolean }
    gmailAppPassword?: string
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  const name = body.name ? String(body.name).trim().slice(0, 80) : undefined
  const systemPrompt = body.systemPrompt
    ? String(body.systemPrompt).trim().slice(0, MAX_SYSTEM_PROMPT) || null
    : null
  // Normalize the settings through the shared parser so only known keys persist.
  const settings = serializeSettings(parseSettings(body.settings ? JSON.stringify(body.settings) : null))

  // Optional Gmail connection — the App Password alone. The sender address is
  // just the account email above (no separate Gmail field). App Passwords are
  // 16 letters, often shown in spaced groups of four — strip whitespace first.
  const gmailAppPasswordRaw = body.gmailAppPassword ? String(body.gmailAppPassword).replace(/\s+/g, "") : ""

  if (!EMAIL_RE.test(email) || email.length > 320) return jsonResponse({ error: "Enter a valid email address." }, { status: 400 }, req)
  if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters." }, { status: 400 }, req)
  if (password.length > MAX_PASSWORD_LEN) return jsonResponse({ error: "Password is too long." }, { status: 400 }, req)
  if (gmailAppPasswordRaw && gmailAppPasswordRaw.length !== 16)
    return jsonResponse({ error: "A Gmail App Password is 16 characters." }, { status: 400 }, req)

  if (await getUserByEmail(email)) return jsonResponse({ error: "An account with that email already exists." }, { status: 409 }, req)

  const user = await createUser(email, await hashPassword(password), name, {
    systemPrompt,
    settings,
    gmailAppPassword: gmailAppPasswordRaw ? encryptSecret(gmailAppPasswordRaw) : null,
  })
  await startSession(user.id)
  return jsonResponse({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 }, req)
}
