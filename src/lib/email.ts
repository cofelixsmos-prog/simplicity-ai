// Server-only Gmail SMTP sending. Authenticates with a Google OAuth refresh
// token (preferred, XOAUTH2) when present, or a legacy App Password. The sender
// address is the connected/account email.
import nodemailer, { type Transporter } from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"
import { decryptSecret } from "@/lib/crypto"
import { googleConfig } from "@/lib/google-oauth"
import type { User } from "@/lib/db/schema"

export interface EmailFile {
  filename: string
  content: Buffer
  contentType?: string
}

export interface OutgoingEmail {
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
  attachments?: EmailFile[]
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Build an SMTP transport for this user, or null if Gmail isn't connected.
// `from` is the connected/account email. Reuse one transport for a whole batch.
// Force IPv4: some hosts (e.g. Render) have no IPv6 egress, but DNS resolves
// smtp.gmail.com to an IPv6 address first → connect ENETUNREACH on ::…:465.
export function getGmailTransport(user: User): { transport: Transporter; from: string } | null {
  const from = (user.gmailAddress || user.email).trim()

  // Preferred: Google OAuth2 (XOAUTH2). nodemailer refreshes access tokens itself
  // from the refresh token + client credentials.
  const refresh = decryptSecret(user.gmailRefreshToken)
  const cfg = googleConfig()
  if (refresh && cfg) {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: from,
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        refreshToken: refresh,
      },
      family: 4,
    } as SMTPTransport.Options)
    return { transport, from }
  }

  // Legacy: App Password.
  const pass = decryptSecret(user.gmailAppPassword)
  if (!pass) return null
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: from, pass },
    family: 4,
  } as SMTPTransport.Options)
  return { transport, from }
}

// Verify the credentials work (the "Test Connection" action) without sending.
export async function verifyGmail(user: User): Promise<{ ok: boolean; error?: string }> {
  const t = getGmailTransport(user)
  if (!t) return { ok: false, error: "Gmail isn't connected." }
  try {
    await t.transport.verify()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: friendlySmtpError(e) }
  } finally {
    t.transport.close()
  }
}

// Send one email through an already-built transport.
export async function sendVia(
  transport: Transporter,
  from: string,
  email: OutgoingEmail
): Promise<{ ok: boolean; error?: string }> {
  try {
    await transport.sendMail({
      from,
      to: email.to,
      cc: email.cc || undefined,
      bcc: email.bcc || undefined,
      subject: email.subject || "(no subject)",
      text: email.body || "",
      attachments: email.attachments?.length ? email.attachments : undefined,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: friendlySmtpError(e) }
  }
}

// Turn nodemailer/SMTP errors into something safe and human — never leak the
// password or raw stack, and give the common Gmail failure a clear fix.
function friendlySmtpError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/invalid login|username and password not accepted|5\.7\.8|535|invalid_grant|unauthorized/i.test(msg))
    return "Gmail rejected the login. Try disconnecting and reconnecting Gmail to refresh access."
  if (/ETIMEDOUT|ECONNECTION|ENOTFOUND|ECONNREFUSED/i.test(msg))
    return "Couldn't reach Gmail's servers. Check your connection and try again."
  return msg.slice(0, 200)
}
