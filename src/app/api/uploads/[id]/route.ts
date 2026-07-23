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

  // Only render a narrow allowlist of types inline in the browser. Anything else
  // is forced to download, so a stored file can never execute as HTML/JS on our
  // origin (stored-XSS defense-in-depth). nosniff stops MIME-sniffing bypasses.
  const mime = upload.mime || "application/octet-stream"
  const INLINE_OK = mime === "application/pdf" || mime.startsWith("image/")
  const wantsDownload = new URL(req.url).searchParams.get("download") != null
  const inline = INLINE_OK && !wantsDownload
  // Strip characters that could inject response headers via the filename.
  const safeName = upload.name.replace(/[\r\n"\\]/g, "_").slice(0, 200)

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  })
}
