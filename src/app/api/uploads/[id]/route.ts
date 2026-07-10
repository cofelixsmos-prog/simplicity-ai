import { getCurrentUser } from "@/lib/auth"
import { getUpload } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Serve a stored upload's bytes to its owner — used to view/download files the
// assistant generated (e.g. a create_pdf result).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { id } = await ctx.params
  const upload = await getUpload(id, user.id)
  if (!upload) return new Response("Not found", { status: 404 })

  const bytes = Buffer.from(upload.data, "base64")
  const inline = new URL(req.url).searchParams.get("download") == null
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": upload.mime || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${upload.name.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  })
}
