import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getCurrentUser } from "@/lib/auth"
import { googleConfig, buildAuthUrl, redirectUri, originOf } from "@/lib/google-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Kick off the Google OAuth consent flow (secure Gmail connect). Requires a
// signed-in user; sets a short-lived CSRF cookie and redirects to Google.
export async function GET(req: Request) {
  const origin = originOf(req)
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const cfg = googleConfig()
  if (!cfg) return NextResponse.redirect(`${origin}/chat?gmail=unconfigured`)

  const state = randomBytes(16).toString("hex")
  const res = NextResponse.redirect(buildAuthUrl(cfg, redirectUri(req), state))
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete consent
  })
  return res
}
