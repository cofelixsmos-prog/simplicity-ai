// Server-only Gmail IMAP access (reading, deleting, flagging, drafts). Uses the
// same auth as sending: a Google OAuth access token (XOAUTH2) when connected via
// OAuth, or a legacy App Password. Every call opens a fresh connection and closes
// it — simple and stateless, fine for the interactive volumes here.
import dns from "dns"
import { ImapFlow, type MailboxObject } from "imapflow"
import { simpleParser } from "mailparser"
import MailComposer from "nodemailer/lib/mail-composer"
import { decryptSecret } from "@/lib/crypto"
import { googleConfig, getAccessToken } from "@/lib/google-oauth"
import type { User } from "@/lib/db/schema"

// Prefer IPv4 when resolving hostnames. imapflow has no `family` option, and on
// hosts without IPv6 egress (e.g. Render) an AAAA result causes the IMAP socket
// to fail with connect ENETUNREACH. This makes dns.lookup return IPv4 first.
try {
  dns.setDefaultResultOrder("ipv4first")
} catch {
  /* older Node without this API */
}

export interface InboxItem {
  uid: number
  from: string
  subject: string
  date: string
  seen: boolean
  flagged: boolean
  snippet: string
  body?: string // present when a full read was requested
}

async function makeClient(user: User): Promise<ImapFlow | null> {
  const auth = (user.gmailAddress || user.email).trim()
  const common = {
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    logger: false,
    // Fail fast rather than hang the chat turn if Gmail is unreachable.
    socketTimeout: 20_000,
  } as const

  // Preferred: OAuth2 access token (minted from the stored refresh token).
  const refresh = decryptSecret(user.gmailRefreshToken)
  const cfg = googleConfig()
  if (refresh && cfg) {
    const accessToken = await getAccessToken(cfg, refresh)
    if (!accessToken) return null
    return new ImapFlow({ ...common, auth: { user: auth, accessToken } })
  }

  // Legacy: App Password.
  const pass = decryptSecret(user.gmailAppPassword)
  if (!pass) return null
  return new ImapFlow({ ...common, auth: { user: auth, pass } })
}

// Resolve a special-use mailbox (\Trash, \Drafts, \All) to its real path, since
// the English "[Gmail]/…" names aren't guaranteed across locales.
async function resolvePath(client: ImapFlow, specialUse: string, fallback: string): Promise<string> {
  try {
    const boxes = await client.list()
    const hit = boxes.find((b) => b.specialUse === specialUse)
    return hit?.path ?? fallback
  } catch {
    return fallback
  }
}

export function friendlyImapError(e: unknown): string {
  // imapflow flags auth failures on the error object rather than always in the
  // message (which can be a generic "Command failed").
  const err = e as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string }
  const blob = `${err?.code ?? ""} ${err?.responseText ?? ""} ${err?.message ?? String(e)}`
  if (err?.authenticationFailed || /invalid credentials|authentication failed|AUTHENTICATIONFAILED|Application-specific|Command failed/i.test(blob))
    return "Gmail rejected the login. Try disconnecting and reconnecting Gmail, and make sure IMAP is enabled in Gmail settings."
  if (/ETIMEDOUT|ECONNECTION|ENOTFOUND|ECONNREFUSED|timeout/i.test(blob))
    return "Couldn't reach Gmail over IMAP. Check the connection and that IMAP is enabled in Gmail settings."
  return (err?.message ?? String(e)).slice(0, 200)
}

// Run a function with a connected client, always cleaning up.
async function withClient<T>(user: User, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const client = await makeClient(user)
  if (!client) throw new Error("Gmail is not connected.")
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.logout().catch(() => {})
  }
}

export async function verifyImap(user: User): Promise<{ ok: boolean; error?: string }> {
  try {
    await withClient(user, async () => {})
    return { ok: true }
  } catch (e) {
    return { ok: false, error: friendlyImapError(e) }
  }
}

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v)
const addr = (a?: { name?: string; address?: string }[]) => {
  const x = a?.[0]
  if (!x) return ""
  return x.name ? `${x.name} <${x.address ?? ""}>` : x.address ?? ""
}

// List (optionally searched) messages in a mailbox, newest first, with a short
// snippet. When `full` is set, each item also carries the full text body.
export async function listMessages(
  user: User,
  opts: { mailbox?: string; limit?: number; query?: string; full?: boolean } = {}
): Promise<InboxItem[]> {
  const mailbox = opts.mailbox ?? "INBOX"
  const limit = Math.min(Math.max(opts.limit ?? 15, 1), 40)
  return withClient(user, async (client) => {
    const lock = await client.getMailboxLock(mailbox)
    try {
      const mb = client.mailbox as MailboxObject
      let uids: number[]
      if (opts.query && opts.query.trim()) {
        const q = opts.query.trim()
        uids = (await client.search({ or: [{ subject: q }, { from: q }, { body: q }] }, { uid: true })) || []
        uids = uids.slice(-limit)
      } else {
        // Newest `limit` by sequence number → uids.
        const total = mb.exists
        if (!total) return []
        const start = Math.max(1, total - limit + 1)
        const found = await client.search({ seq: `${start}:*` }, { uid: true })
        uids = found || []
      }
      if (uids.length === 0) return []

      const items: InboxItem[] = []
      for await (const msg of client.fetch(uids, { uid: true, envelope: true, flags: true, source: true }, { uid: true })) {
        let text = ""
        try {
          const parsed = await simpleParser(msg.source as Buffer)
          text = (parsed.text || "").replace(/\s+/g, " ").trim()
        } catch {
          /* unparseable body */
        }
        const env = msg.envelope
        const flags = msg.flags ?? new Set<string>()
        items.push({
          uid: msg.uid,
          from: addr(env?.from),
          subject: String(one(env?.subject) ?? "(no subject)"),
          date: (env?.date instanceof Date ? env.date : new Date()).toISOString(),
          seen: flags.has("\\Seen"),
          flagged: flags.has("\\Flagged"),
          snippet: text.slice(0, 200),
          body: opts.full ? text.slice(0, 4000) : undefined,
        })
      }
      // Newest first.
      items.sort((a, b) => +new Date(b.date) - +new Date(a.date))
      return items
    } finally {
      lock.release()
    }
  })
}

// Move messages to Trash (recoverable). Returns how many were moved.
export async function trashMessages(user: User, uids: number[]): Promise<number> {
  if (uids.length === 0) return 0
  return withClient(user, async (client) => {
    const lock = await client.getMailboxLock("INBOX")
    try {
      const trash = await resolvePath(client, "\\Trash", "[Gmail]/Trash")
      await client.messageMove(uids, trash, { uid: true })
      return uids.length
    } finally {
      lock.release()
    }
  })
}

export type ModifyAction = "mark_read" | "mark_unread" | "star" | "unstar" | "archive"

// Change message state (flags / archive). Reversible; no confirmation gate.
export async function modifyMessages(user: User, uids: number[], action: ModifyAction): Promise<number> {
  if (uids.length === 0) return 0
  return withClient(user, async (client) => {
    const lock = await client.getMailboxLock("INBOX")
    try {
      if (action === "mark_read") await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true })
      else if (action === "mark_unread") await client.messageFlagsRemove(uids, ["\\Seen"], { uid: true })
      else if (action === "star") await client.messageFlagsAdd(uids, ["\\Flagged"], { uid: true })
      else if (action === "unstar") await client.messageFlagsRemove(uids, ["\\Flagged"], { uid: true })
      else if (action === "archive") {
        const all = await resolvePath(client, "\\All", "[Gmail]/All Mail")
        await client.messageMove(uids, all, { uid: true }) // removing from INBOX = archive
      }
      return uids.length
    } finally {
      lock.release()
    }
  })
}

// Save a draft into Gmail's Drafts folder.
export async function saveDraft(
  user: User,
  draft: { to: string; subject: string; body: string }
): Promise<void> {
  const from = (user.gmailAddress || user.email).trim()
  const raw = await new MailComposer({
    from,
    to: draft.to,
    subject: draft.subject || "(no subject)",
    text: draft.body || "",
  })
    .compile()
    .build()
  await withClient(user, async (client) => {
    const drafts = await resolvePath(client, "\\Drafts", "[Gmail]/Drafts")
    await client.append(drafts, raw, ["\\Draft"])
  })
}
