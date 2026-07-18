// Data-access layer. ALL persistence goes through these functions, so moving
// from libSQL/SQLite to PostgreSQL later means reimplementing only this file.
import { randomUUID } from "crypto"
import { and, desc, eq, lt, isNotNull } from "drizzle-orm"
import { db, initDb } from "./index"
import { users, sessions, conversations, messages, uploads, memories, type User, type Conversation, type Message, type Upload, type Memory } from "./schema"

// ── Users ───────────────────────────────────────────────────────────────────
export async function createUser(
  email: string,
  passwordHash: string,
  name?: string,
  extra?: {
    systemPrompt?: string | null
    settings?: string | null
    gmailAddress?: string | null
    gmailAppPassword?: string | null
  }
): Promise<User> {
  await initDb()
  const row: User = {
    id: randomUUID(),
    email,
    name: name ?? null,
    passwordHash,
    systemPrompt: extra?.systemPrompt ?? null,
    settings: extra?.settings ?? null,
    gmailAddress: extra?.gmailAddress ?? null,
    gmailAppPassword: extra?.gmailAppPassword ?? null,
    gmailRefreshToken: null,
    createdAt: Date.now(),
  }
  await db.insert(users).values(row)
  return row
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  await initDb()
  return (await db.select().from(users).where(eq(users.email, email)))[0]
}

export async function getUserById(id: string): Promise<User | undefined> {
  await initDb()
  return (await db.select().from(users).where(eq(users.id, id)))[0]
}

// Set (or with a null password, clear) the user's Gmail connection.
export async function setUserSettings(userId: string, settings: string): Promise<void> {
  await initDb()
  await db.update(users).set({ settings }).where(eq(users.id, userId))
}

export async function setUserSystemPrompt(userId: string, systemPrompt: string | null): Promise<void> {
  await initDb()
  await db.update(users).set({ systemPrompt }).where(eq(users.id, userId))
}

export async function setUserName(userId: string, name: string): Promise<void> {
  await initDb()
  await db.update(users).set({ name }).where(eq(users.id, userId))
}

// Legacy App-Password path (and full disconnect via null, null). Always clears
// any OAuth refresh token — the two auth methods are mutually exclusive.
export async function setUserGmail(
  id: string,
  gmailAddress: string | null,
  gmailAppPassword: string | null
): Promise<void> {
  await initDb()
  await db
    .update(users)
    .set({ gmailAddress, gmailAppPassword, gmailRefreshToken: null })
    .where(eq(users.id, id))
}

// OAuth path: store the encrypted refresh token + connected address, clearing
// any legacy App Password.
export async function setUserGmailOAuth(
  id: string,
  gmailAddress: string | null,
  gmailRefreshToken: string
): Promise<void> {
  await initDb()
  await db
    .update(users)
    .set({ gmailAddress, gmailRefreshToken, gmailAppPassword: null })
    .where(eq(users.id, id))
}

// ── Uploads (files kept for emailing as attachments) ────────────────────────
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000 // pruned after a day

export async function createUpload(userId: string, name: string, mime: string, dataB64: string): Promise<string> {
  await initDb()
  const id = randomUUID()
  await db.insert(uploads).values({ id, userId, name: name.slice(0, 200), mime, data: dataB64, createdAt: Date.now() })
  // Opportunistic cleanup so the table never grows unbounded.
  void db.delete(uploads).where(lt(uploads.createdAt, Date.now() - UPLOAD_TTL_MS)).catch(() => {})
  return id
}

// Fetch an upload the given user owns (ownership check prevents cross-user access).
export async function getUpload(id: string, userId: string): Promise<Upload | undefined> {
  await initDb()
  return (await db.select().from(uploads).where(and(eq(uploads.id, id), eq(uploads.userId, userId))))[0]
}

// Find a user's most-recent upload matching a filename (case-insensitive). Lets
// the agent attach a file it created in an EARLIER turn ("email me that PDF")
// without the file id having to survive in the turn context.
export async function getUploadByName(userId: string, name: string): Promise<Upload | undefined> {
  await initDb()
  const target = name.trim().toLowerCase()
  const rows = await db
    .select()
    .from(uploads)
    .where(eq(uploads.userId, userId))
    .orderBy(desc(uploads.createdAt))
  return rows.find((u) => u.name.toLowerCase() === target)
}

// ── Sessions ────────────────────────────────────────────────────────────────
export async function createSession(token: string, userId: string, expiresAt: number): Promise<void> {
  await initDb()
  await db.insert(sessions).values({ id: token, userId, expiresAt, createdAt: Date.now() })
}

// Returns the user for a live (non-expired) session token, else undefined.
export async function getSessionUser(token: string): Promise<User | undefined> {
  await initDb()
  const s = (await db.select().from(sessions).where(eq(sessions.id, token)))[0]
  if (!s) return undefined
  if (s.expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token))
    return undefined
  }
  return getUserById(s.userId)
}

export async function deleteSession(token: string): Promise<void> {
  await initDb()
  await db.delete(sessions).where(eq(sessions.id, token))
}

// Sweep out expired sessions (called opportunistically on login).
export async function pruneExpiredSessions(): Promise<void> {
  await initDb()
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()))
}

// ── Conversations ───────────────────────────────────────────────────────────
export async function createConversation(userId: string, title: string): Promise<Conversation> {
  await initDb()
  const now = Date.now()
  const row: Conversation = { id: randomUUID(), userId, title: title.slice(0, 200) || "New chat", pinned: 0, createdAt: now, updatedAt: now }
  await db.insert(conversations).values(row)
  return row
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  await initDb()
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.pinned), desc(conversations.updatedAt))
}

export async function setConversationPinned(id: string, userId: string, pinned: boolean): Promise<void> {
  await initDb()
  await db
    .update(conversations)
    .set({ pinned: pinned ? 1 : 0 })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
}

export async function getConversation(id: string, userId: string): Promise<Conversation | undefined> {
  await initDb()
  return (await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))))[0]
}

export async function renameConversation(id: string, userId: string, title: string): Promise<void> {
  await initDb()
  await db.update(conversations).set({ title: title.slice(0, 200), updatedAt: Date.now() }).where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
}

export async function touchConversation(id: string): Promise<void> {
  await initDb()
  await db.update(conversations).set({ updatedAt: Date.now() }).where(eq(conversations.id, id))
}

export async function deleteConversation(id: string, userId: string): Promise<void> {
  await initDb()
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
  await db.delete(messages).where(eq(messages.conversationId, id))
}

// ── Messages ────────────────────────────────────────────────────────────────
export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  artifacts?: string | null
): Promise<Message> {
  await initDb()
  const row: Message = { id: randomUUID(), conversationId, role, content, artifacts: artifacts ?? null, createdAt: Date.now() }
  await db.insert(messages).values(row)
  await touchConversation(conversationId)
  return row
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  await initDb()
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt)
}

export async function updateMessageArtifacts(
  conversationId: string,
  messageIndex: number,
  artifacts: string
): Promise<boolean> {
  await initDb()
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
  const target = rows[messageIndex]
  if (!target) return false
  await db.update(messages).set({ artifacts }).where(eq(messages.id, target.id))
  return true
}

// Every reopenable artifact (apps, drafts) the user has ever made, newest first,
// aggregated across all their conversations for the artifacts gallery.
export interface ArtifactEntry {
  kind: "app" | "draft" | "email" | "file"
  id: string
  title: string
  conversationId: string
  createdAt: number
  data: unknown
}

export async function listUserArtifacts(userId: string, limit = 200): Promise<ArtifactEntry[]> {
  await initDb()
  const rows = await db
    .select({ artifacts: messages.artifacts, conversationId: messages.conversationId, createdAt: messages.createdAt })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), isNotNull(messages.artifacts)))
    .orderBy(desc(messages.createdAt))

  const out: ArtifactEntry[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.artifacts) continue
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(r.artifacts)
    } catch {
      continue
    }
    for (const kind of ["app", "draft"] as const) {
      const a = parsed[kind] as { id?: string; title?: string } | undefined
      if (!a || !a.id || seen.has(a.id)) continue
      seen.add(a.id)
      out.push({
        kind,
        id: a.id,
        title: (a.title || (kind === "app" ? "Untitled app" : "Untitled draft")).slice(0, 200),
        conversationId: r.conversationId,
        createdAt: r.createdAt,
        data: a,
      })
      if (out.length >= limit) return out
    }
    // Emails staged for sending
    if (Array.isArray(parsed.email) && parsed.email.length) {
      const emails = parsed.email as { to?: string; subject?: string }[]
      const eid = `email-${r.createdAt}`
      if (!seen.has(eid)) {
        seen.add(eid)
        const first = emails[0]
        out.push({
          kind: "email",
          id: eid,
          title: first?.subject || `Email to ${first?.to || "someone"}`,
          conversationId: r.conversationId,
          createdAt: r.createdAt,
          data: parsed.email,
        })
        if (out.length >= limit) return out
      }
    }
    // Generated files (PDFs etc.)
    if (parsed.file && typeof parsed.file === "object") {
      const f = parsed.file as { id?: string; name?: string }
      if (f.id && !seen.has(f.id)) {
        seen.add(f.id)
        out.push({
          kind: "file",
          id: f.id,
          title: f.name || "Document",
          conversationId: r.conversationId,
          createdAt: r.createdAt,
          data: parsed.file,
        })
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

// ── Memory (persistent facts the assistant learns about the user) ─────────────
const MEMORY_CAP = 80 // keep the newest N; prune older so it never grows unbounded

export async function addMemory(userId: string, content: string): Promise<Memory | null> {
  await initDb()
  const trimmed = content.trim().slice(0, 400)
  if (!trimmed) return null
  // Skip near-duplicates (same normalized text already stored).
  const norm = trimmed.toLowerCase()
  const existing = await db.select().from(memories).where(eq(memories.userId, userId))
  if (existing.some((m) => m.content.trim().toLowerCase() === norm)) return null

  const row: Memory = { id: randomUUID(), userId, content: trimmed, createdAt: Date.now() }
  await db.insert(memories).values(row)

  // Prune anything beyond the cap (oldest first).
  if (existing.length + 1 > MEMORY_CAP) {
    const old = [...existing, row]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(MEMORY_CAP)
      .map((m) => m.id)
    for (const id of old) await db.delete(memories).where(eq(memories.id, id))
  }
  return row
}

export async function listMemories(userId: string, limit = MEMORY_CAP): Promise<Memory[]> {
  await initDb()
  return db.select().from(memories).where(eq(memories.userId, userId)).orderBy(desc(memories.createdAt)).limit(limit)
}

export async function deleteMemory(id: string, userId: string): Promise<void> {
  await initDb()
  await db.delete(memories).where(and(eq(memories.id, id), eq(memories.userId, userId)))
}

export async function clearMemories(userId: string): Promise<void> {
  await initDb()
  await db.delete(memories).where(eq(memories.userId, userId))
}
