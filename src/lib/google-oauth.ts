// Google OAuth2 for Gmail + Drive — the secure alternative to App Passwords. We
// request offline access, store only the encrypted refresh token, and mint
// short-lived access tokens on demand (one grant covers both Gmail and Drive).

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
// mail.google.com is mandatory for SMTP/IMAP XOAUTH2. drive.readonly lets us
// search/read the user's existing files; drive.file lets us create new ones.
export const GOOGLE_SCOPE = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
].join(" ")

export interface GoogleConfig {
  clientId: string
  clientSecret: string
}

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

// The app's own origin, honoring proxy headers (Render terminates TLS and
// forwards the real host/proto).
export function originOf(req: Request): string {
  const h = req.headers
  const proto = h.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host
  return `${proto}://${host}`
}

// The redirect URI must exactly match one registered in the Google console.
// Prefer an explicit env; otherwise derive it from the incoming request so the
// same build works on localhost and in production.
export function redirectUri(req: Request): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${originOf(req)}/auth/google/callback`
}

export function buildAuthUrl(cfg: GoogleConfig, redirect: string, state: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force a refresh token even on re-auth
    include_granted_scopes: "true",
    state,
  })
  return `${AUTH_URL}?${p.toString()}`
}

// Decode the email from an id_token's payload (no signature check needed — the
// token came straight from Google's token endpoint over TLS).
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = idToken.split(".")[1]
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    const o = JSON.parse(json) as { email?: string; email_verified?: boolean }
    return o.email ?? null
  } catch {
    return null
  }
}

export interface ExchangeResult {
  refreshToken: string
  accessToken: string
  email: string | null
  expiresIn: number
}

// Trade an authorization code for tokens.
export async function exchangeCode(cfg: GoogleConfig, code: string, redirect: string): Promise<ExchangeResult> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
  }
  if (!data.refresh_token) {
    // Google only returns a refresh token on the first consent; prompt=consent
    // above should force one, but guard anyway.
    throw new Error("Google did not return a refresh token. Remove Simplicity's access in your Google account and reconnect.")
  }
  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token ?? "",
    email: emailFromIdToken(data.id_token),
    expiresIn: data.expires_in ?? 3600,
  }
}

// Mint a fresh access token from a refresh token, cached in-memory until shortly
// before it expires (access tokens last ~1h).
const cache = new Map<string, { token: string; exp: number }>()

export async function getAccessToken(cfg: GoogleConfig, refreshToken: string): Promise<string | null> {
  const hit = cache.get(refreshToken)
  if (hit && hit.exp > Date.now() + 60_000) return hit.token
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null
  cache.set(refreshToken, { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 })
  return data.access_token
}
