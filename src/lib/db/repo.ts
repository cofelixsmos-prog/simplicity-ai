// Data-access layer. ALL persistence goes through these functions, so moving
// from libSQL/SQLite to PostgreSQL later means reimplementing only this file.
import { randomUUID } from "crypto"
import { and, desc, eq } from "drizzle-orm"
import { db, initDb } from "./index"
import { users, sessions, conversations, messages, type User, type Conversation, type Message } from "./schema"

// ── Users ───────────────────────────────────────────────────────────────────
export async function createUser(email: string, passwordHash: string, name?: string): Promise<User> {
  await initDb()
  const row: User = { id: randomUUID(), email, name: name ?? null, passwordHash, createdAt: Date.now() }
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

// ── Conversations ───────────────────────────────────────────────────────────
export async function createConversation(userId: string, title: string): Promise<Conversation> {
  await initDb()
  const now = Date.now()
  const row: Conversation = { id: randomUUID(), userId, title: title.slice(0, 200) || "New chat", createdAt: now, updatedAt: now }
  await db.insert(conversations).values(row)
  return row
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  await initDb()
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt))
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
export async function addMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<Message> {
  await initDb()
  const row: Message = { id: randomUUID(), conversationId, role, content, createdAt: Date.now() }
  await db.insert(messages).values(row)
  await touchConversation(conversationId)
  return row
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  await initDb()
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt)
}
