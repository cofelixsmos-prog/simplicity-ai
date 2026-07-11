import { db, initDb } from "@/lib/db"
import { apps } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_FILES_JSON = 500_000 // chars of the serialized files array
const MAX_TITLE = 300 // chars
const MAX_ENTRY = 200 // chars
const ID_RE = /^[0-9a-fA-F-]{8,40}$/ // bounds the id (randomUUID shape)

export function OPTIONS(req: Request) {
  return preflight(req)
}

// GET a single app project (used when the code canvas reloads it). Owner-only.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(`app-get:${clientIp(req)}`, 60, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests." }, { status: 429 }, req)

  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const { id } = await ctx.params
  if (!ID_RE.test(id)) return jsonResponse({ error: "invalid id" }, { status: 400 }, req)

  await initDb()
  const row = (await db.select().from(apps).where(eq(apps.id, id)))[0]
  // Rows created before the user_id column existed have a null owner — treat
  // those as inaccessible too rather than silently allowing anyone to read them.
  if (!row || row.userId !== user.id) return jsonResponse({ error: "not found" }, { status: 404 }, req)
  return jsonResponse(row, { status: 200 }, req)
}

// PATCH the title/files/entry of an app — called by the canvas's debounced autosave. Owner-only.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(`app-patch:${clientIp(req)}`, 40, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests." }, { status: 429 }, req)

  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const { id } = await ctx.params
  if (!ID_RE.test(id)) return jsonResponse({ error: "invalid id" }, { status: 400 }, req)

  let body: { title?: string; files?: unknown; entry?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "invalid body" }, { status: 400 }, req)
  }

  // The client sends `files` as an array; we store it as a JSON string. Validate
  // shape + bound the size (DoS protection on a small instance).
  let filesJson: string | undefined
  if (body.files !== undefined) {
    if (
      !Array.isArray(body.files) ||
      !body.files.every(
        (f) => f && typeof (f as { name?: unknown }).name === "string" && typeof (f as { content?: unknown }).content === "string"
      )
    )
      return jsonResponse({ error: "files must be an array of { name, content }" }, { status: 400 }, req)
    filesJson = JSON.stringify(body.files)
  }

  if (
    (filesJson?.length ?? 0) > MAX_FILES_JSON ||
    (body.title?.length ?? 0) > MAX_TITLE ||
    (body.entry?.length ?? 0) > MAX_ENTRY
  )
    return jsonResponse({ error: "app too large" }, { status: 413 }, req)

  await initDb()
  const existing = (await db.select().from(apps).where(eq(apps.id, id)))[0]
  if (!existing || existing.userId !== user.id) return jsonResponse({ error: "not found" }, { status: 404 }, req)

  await db
    .update(apps)
    .set({
      title: body.title ?? existing.title,
      files: filesJson ?? existing.files,
      entry: body.entry ?? existing.entry,
      updatedAt: Date.now(),
    })
    .where(eq(apps.id, id))

  return jsonResponse({ ok: true }, { status: 200 }, req)
}
