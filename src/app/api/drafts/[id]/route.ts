import { db, initDb } from "@/lib/db"
import { drafts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET a single draft (used if the editor needs to reload it).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await initDb()
  const row = (await db.select().from(drafts).where(eq(drafts.id, id)))[0]
  if (!row) return Response.json({ error: "not found" }, { status: 404 })
  return Response.json(row)
}

// PATCH the title/content of a draft — called by the canvas's debounced autosave.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let body: { title?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 })
  }

  await initDb()
  const existing = (await db.select().from(drafts).where(eq(drafts.id, id)))[0]
  if (!existing) return Response.json({ error: "not found" }, { status: 404 })

  await db
    .update(drafts)
    .set({
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
      updatedAt: Date.now(),
    })
    .where(eq(drafts.id, id))

  return Response.json({ ok: true })
}
