import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { googleConfig, buildAuthUrl, redirectUri, originOf } from "@/lib/google-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Initiate Google OAuth for signup/login. Sets CSRF state cookie and redirects to Google consent.
// After consent, Google redirects to /auth/google/callback?code=...&state=...
export async function GET(req: Request) {
  const origin = originOf(req)
  const cfg = googleConfig()
  if (!cfg) return NextResponse.redirect(`${origin}/register?error=unconfigured`)

  const state = randomBytes(16).toString("hex")
  const res = NextResponse.redirect(buildAuthUrl(cfg, redirectUri(req), state))
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })
  return res
}
