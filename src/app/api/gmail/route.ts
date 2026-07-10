import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUserRow } from "@/lib/auth"
import { setUserGmail } from "@/lib/db/repo"
import { encryptSecret } from "@/lib/crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// GET → connection status (address is safe to surface; the password never is).
export async function GET(req: Request) {
  const user = await getCurrentUserRow()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  return jsonResponse(
    {
      connected: !!(user.gmailAppPassword || user.gmailRefreshToken),
      method: user.gmailRefreshToken ? "oauth" : user.gmailAppPassword ? "app_password" : null,
      address: user.gmailAddress || user.email,
    },
    { status: 200 },
    req
  )
}

// POST → connect / update: store a new App Password (sender = account email).
export async function POST(req: Request) {
  const rl = rateLimit(`gmailconn:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many attempts. Try again shortly." }, { status: 429 }, req)

  const user = await getCurrentUserRow()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  let body: { appPassword?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const appPassword = String(body.appPassword ?? "").replace(/\s+/g, "")
  if (appPassword.length !== 16) return jsonResponse({ error: "A Gmail App Password is 16 characters." }, { status: 400 }, req)

  await setUserGmail(user.id, null, encryptSecret(appPassword))
  return jsonResponse({ connected: true, address: user.email }, { status: 200 }, req)
}

// DELETE → disconnect: clear the stored credentials entirely.
export async function DELETE(req: Request) {
  const user = await getCurrentUserRow()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  await setUserGmail(user.id, null, null)
  return jsonResponse({ connected: false }, { status: 200 }, req)
}
