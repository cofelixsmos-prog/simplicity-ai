import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

// Connection is configurable via DATABASE_URL:
//   - "file:simplicity.db"          → local SQLite file (default)
//   - "libsql://...".  + AUTH_TOKEN → hosted libSQL / Turso (SQLite-compatible)
// To move to PostgreSQL later, swap this client + the repo layer (src/lib/db/repo.ts);
// app code only talks to the repo, so the change stays contained.
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:simplicity.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })

// Lazily ensure the schema exists (idempotent) — no separate migration step for dev.
let ready: Promise<void> | null = null
export function initDb(): Promise<void> {
  ready ??= (async () => {
    await client.batch(
      [
        `CREATE TABLE IF NOT EXISTS drafts (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL )`,
        `CREATE TABLE IF NOT EXISTS apps (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, files TEXT NOT NULL, entry TEXT NOT NULL,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL )`,
        `CREATE TABLE IF NOT EXISTS uploads (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL,
          data TEXT NOT NULL, created_at INTEGER NOT NULL )`,
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT,
          password_hash TEXT NOT NULL, system_prompt TEXT, settings TEXT,
          gmail_address TEXT, gmail_app_password TEXT,
          created_at INTEGER NOT NULL )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL )`,
        `CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL )`,
        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
          content TEXT NOT NULL, created_at INTEGER NOT NULL )`,
        `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
        `CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id)`,
      ],
      "write"
    )
    // Additive migrations for DBs created before these columns existed. SQLite
    // has no "ADD COLUMN IF NOT EXISTS", so each is attempted individually and
    // the "duplicate column" error is swallowed — keeping startup idempotent.
    for (const sql of [
      `ALTER TABLE users ADD COLUMN system_prompt TEXT`,
      `ALTER TABLE users ADD COLUMN settings TEXT`,
      `ALTER TABLE users ADD COLUMN gmail_address TEXT`,
      `ALTER TABLE users ADD COLUMN gmail_app_password TEXT`,
    ]) {
      try {
        await client.execute(sql)
      } catch {
        /* column already exists */
      }
    }
  })()
  return ready
}
