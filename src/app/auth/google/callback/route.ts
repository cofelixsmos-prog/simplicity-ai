import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUserRow } from "@/lib/auth"
import { setUserGmailOAuth } from "@/lib/db/repo"
import { encryptSecret } from "@/lib/crypto"
import { googleConfig, exchangeCode, redirectUri, originOf } from "@/lib/google-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Google redirects here after consent. Verify state (CSRF), trade the code for a
// refresh token, store it encrypted, and return to the chat.
export async function GET(req: Request) {
  const origin = originOf(req)
  const back = (status: string) => NextResponse.redirect(`${origin}/chat?gmail=${status}`)

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  const store = await cookies()
  const expected = store.get("g_oauth_state")?.value
  store.delete("g_oauth_state")

  if (oauthError) return back("denied")
  if (!code || !state || !expected || state !== expected) return back("error")

  const user = await getCurrentUserRow()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const cfg = googleConfig()
  if (!cfg) return back("unconfigured")

  try {
    const tokens = await exchangeCode(cfg, code, redirectUri(req))
    const address = tokens.email || user.email
    await setUserGmailOAuth(user.id, address, encryptSecret(tokens.refreshToken))
    return back("connected")
  } catch (e) {
    console.error("[gmail-oauth] callback failed:", e instanceof Error ? e.message : e)
    return back("error")
  }
}
