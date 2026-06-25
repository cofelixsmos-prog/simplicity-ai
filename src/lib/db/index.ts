import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

// Local SQLite file by default; override with DATABASE_URL (e.g. a Turso URL).
const client = createClient({ url: process.env.DATABASE_URL ?? "file:simplicity.db" })

export const db = drizzle(client, { schema })

// Lazily ensure the schema exists (idempotent). Awaited by any code that
// touches the DB, so we don't need a separate migration step for local dev.
let ready: Promise<void> | null = null
export function initDb(): Promise<void> {
  ready ??= (async () => {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  })()
  return ready
}
