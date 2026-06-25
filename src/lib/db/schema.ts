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
