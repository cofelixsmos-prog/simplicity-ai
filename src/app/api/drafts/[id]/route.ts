import { db, initDb } from "@/lib/db"
import { drafts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CONTENT = 200_000 // chars
const MAX_TITLE = 300 // chars
const ID_RE = /^[0-9a-fA-F-]{8,40}$/ // bounds the id (randomUUID shape)

export function OPTIONS(req: Request) {
  return preflight(req)
}

// GET a single draft (used if the editor needs to reload it). Owner-only.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(`draft-get:${clientIp(req)}`, 60, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests." }, { status: 429 }, req)

  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const { id } = await ctx.params
  if (!ID_RE.test(id)) return jsonResponse({ error: "invalid id" }, { status: 400 }, req)

  await initDb()
  const row = (await db.select().from(drafts).where(eq(drafts.id, id)))[0]
  // Rows created before the user_id column existed have a null owner — treat
  // those as inaccessible too rather than silently allowing anyone to read them.
  if (!row || row.userId !== user.id) return jsonResponse({ error: "not found" }, { status: 404 }, req)
  return jsonResponse(row, { status: 200 }, req)
}

// PATCH the title/content of a draft — called by the canvas's debounced autosave. Owner-only.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(`draft-patch:${clientIp(req)}`, 40, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests." }, { status: 429 }, req)

  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const { id } = await ctx.params
  if (!ID_RE.test(id)) return jsonResponse({ error: "invalid id" }, { status: 400 }, req)

  let body: { title?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "invalid body" }, { status: 400 }, req)
  }

  // Bound the payload (DoS protection).
  if ((body.content?.length ?? 0) > MAX_CONTENT || (body.title?.length ?? 0) > MAX_TITLE)
    return jsonResponse({ error: "draft too large" }, { status: 413 }, req)

  await initDb()
  const existing = (await db.select().from(drafts).where(eq(drafts.id, id)))[0]
  if (!existing || existing.userId !== user.id) return jsonResponse({ error: "not found" }, { status: 404 }, req)

  await db
    .update(drafts)
    .set({
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
      updatedAt: Date.now(),
    })
    .where(eq(drafts.id, id))

  return jsonResponse({ ok: true }, { status: 200 }, req)
}
