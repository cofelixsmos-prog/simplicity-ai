import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

// A draft / essay the agent writes and the user can edit. Stored locally in
// SQLite (libSQL) so drafts survive restarts and can be reopened/edited.
export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(), // markdown
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export type Draft = typeof drafts.$inferSelect

// A multi-file frontend project the coding agent builds and the user can edit
// live (with an in-browser preview). `files` is a JSON array of { name, content };
// `entry` names the file the preview boots from (usually index.html).
export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  files: text("files").notNull(), // JSON: { name: string; content: string }[]
  entry: text("entry").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export type App = typeof apps.$inferSelect

// ── Auth ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // the session token
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
})

// ── Chat history ────────────────────────────────────────────────────────────
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
})

export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Conversation = typeof conversations.$inferSelect
export type Message = typeof messages.$inferSelect
