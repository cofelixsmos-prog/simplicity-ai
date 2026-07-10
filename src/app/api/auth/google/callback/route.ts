import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUserRow } from "@/lib/auth"
import { setUserGmailOAuth, createUser, getUserByEmail } from "@/lib/db/repo"
import { encryptSecret } from "@/lib/crypto"
import { googleConfig, exchangeCode, redirectUri, originOf } from "@/lib/google-oauth"
import { hashPassword, startSession } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Google OAuth callback for both Gmail connect (logged-in user) and signup (new user).
// If user is logged in: connect Gmail. If not: create account and log in.
export async function GET(req: Request) {
  const origin = originOf(req)
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
        newUser = await createUser(
          email,
          await hashPassword(Math.random().toString()),
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
