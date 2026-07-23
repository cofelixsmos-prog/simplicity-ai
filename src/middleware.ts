import { NextResponse, type NextRequest } from "next/server"

// Server-side auth gate. The app pages guard themselves client-side (a fetch to
// /api/auth/me), but that only runs AFTER the page is served — so a logged-out
// visitor could still load the protected page shell. This middleware runs on
// every matched request BEFORE the page renders and bounces anyone without a
// session cookie straight to /login.
//
// It checks cookie PRESENCE only (edge runtime can't cheaply hit the DB); full
// session validation still happens server-side in the page's API calls, which
// reject an expired/forged cookie. Logout clears the cookie, so this fully
// closes the "still see /chat after logout" hole.

const SESSION_COOKIE = "sid"
const PROTECTED = ["/chat", "/studio", "/harness", "/settings"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!needsAuth) return NextResponse.next()

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  if (hasSession) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("next", pathname) // return here after signing in
  const res = NextResponse.redirect(url)
  // Never let a protected page sit in a cache.
  res.headers.set("Cache-Control", "no-store")
  return res
}

export const config = {
  matcher: ["/chat/:path*", "/studio/:path*", "/harness/:path*", "/settings/:path*"],
}
