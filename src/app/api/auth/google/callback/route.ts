import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "crypto"
import { getCurrentUserRow } from "@/lib/auth"
import { setUserGmailOAuth, createUser, getUserByEmail } from "@/lib/db/repo"
import { encryptSecret } from "@/lib/crypto"
import { googleConfig, exchangeCode, redirectUri, originOf } from "@/lib/google-oauth"
import { hashPassword, startSession } from "@/lib/auth"
import { clientIp, tieredRateLimit } from "@/lib/api/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Google OAuth callback for both Gmail connect (logged-in user) and signup (new user).
// If user is logged in: connect Gmail. If not: create account and log in.
export async function GET(req: Request) {
  const origin = originOf(req)

  // Rate-limited per IP: without this, completing Google's consent screen is an
  // unthrottled way to mint free accounts (each burns chat-API budget).
  const rl = tieredRateLimit(`oauth-callback:ip:${clientIp(req)}`, {
    burst: 10,
    burstWindowMs: 60_000,
    sustained: 30,
    sustainedWindowMs: 60 * 60_000,
  })
  if (!rl.ok) return NextResponse.redirect(`${origin}/register?oauth=rate_limited`)

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  const store = await cookies()
  const expected = store.get("g_oauth_state")?.value
  store.delete("g_oauth_state")

  if (oauthError) {
    // If user is logged in, error on Gmail connect page; otherwise on signup
    const user = await getCurrentUserRow()
    return user
      ? NextResponse.redirect(`${origin}/chat?gmail=denied`)
      : NextResponse.redirect(`${origin}/register?oauth=denied`)
  }

  if (!code || !state || !expected || state !== expected) {
    const user = await getCurrentUserRow()
    return user
      ? NextResponse.redirect(`${origin}/chat?gmail=error`)
      : NextResponse.redirect(`${origin}/register?oauth=error`)
  }

  const cfg = googleConfig()
  if (!cfg) {
    const user = await getCurrentUserRow()
    return user
      ? NextResponse.redirect(`${origin}/chat?gmail=unconfigured`)
      : NextResponse.redirect(`${origin}/register?oauth=unconfigured`)
  }

  try {
    const tokens = await exchangeCode(cfg, code, redirectUri(req))
    const email = tokens.email
    if (!email) {
      const user = await getCurrentUserRow()
      return user
        ? NextResponse.redirect(`${origin}/chat?gmail=error`)
        : NextResponse.redirect(`${origin}/register?oauth=no_email`)
    }

    const user = await getCurrentUserRow()
    if (user) {
      // Logged-in user: connect Gmail
      await setUserGmailOAuth(user.id, email, encryptSecret(tokens.refreshToken))
      return NextResponse.redirect(`${origin}/chat?gmail=connected`)
    } else {
      // Not logged in: signup flow
      let newUser = await getUserByEmail(email)
      if (!newUser) {
        const name = email.split("@")[0]
        // This account has no real password — password-based login must never
        // succeed for it. Math.random() is not a CSPRNG and is guessable; use
        // a proper random value even though nothing is meant to derive it back.
        const unusablePassword = randomBytes(32).toString("hex")
        newUser = await createUser(
          email,
          await hashPassword(unusablePassword),
          name,
          { settings: null }
        )
      }
      await startSession(newUser.id)
      return NextResponse.redirect(`${origin}/chat`)
    }
  } catch (e) {
    console.error("[oauth-callback] failed:", e instanceof Error ? e.message : e)
    const user = await getCurrentUserRow()
    return user
      ? NextResponse.redirect(`${origin}/chat?gmail=error`)
      : NextResponse.redirect(`${origin}/register?oauth=error`)
  }
}
