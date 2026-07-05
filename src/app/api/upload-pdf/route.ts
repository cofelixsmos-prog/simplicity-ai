import { jsonResponse, preflight, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { createUpload } from "@/lib/db/repo"
import { getDocumentProxy, extractText } from "unpdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Extracts plain text from an uploaded PDF so it can be folded into the chat
// context — the underlying chat models are text-only completion endpoints,
// not document-aware, so this is done server-side rather than shipping the
// PDF itself to the model.
const MAX_BYTES = 15 * 1024 * 1024 // 15MB
const MAX_TEXT_CHARS = 24_000 // per-file cap so one PDF can't blow the chat context

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const rl = rateLimit(`upload-pdf:${clientIp(req)}`, 20, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many uploads — try again shortly." }, { status: 429 }, req)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonResponse({ error: "Invalid upload." }, { status: 400 }, req)
  }

  const file = form.get("file")
  if (!(file instanceof File)) return jsonResponse({ error: "No file provided." }, { status: 400 }, req)
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return jsonResponse({ error: "Only PDF files are supported." }, { status: 400 }, req)
  }
  if (file.size > MAX_BYTES) {
    return jsonResponse({ error: "PDF is too large (15MB max)." }, { status: 413 }, req)
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    // Capture the base64 NOW — pdf.js detaches the underlying ArrayBuffer when
    // it builds the document proxy, which would leave `bytes` empty afterward.
    const base64 = Buffer.from(bytes).toString("base64")
    const pdf = await getDocumentProxy(bytes)
    const { text, totalPages } = await extractText(pdf, { mergePages: true })
    const trimmed = text.trim()
    if (!trimmed) {
      return jsonResponse(
        { error: "Couldn't find any text in that PDF (it may be scanned images)." },
        { status: 422 },
        req
      )
    }
    // Keep the raw bytes so this file can be attached to an email later. The id
    // is what the email flow references; the extracted text still rides along
    // for the (text-only) chat models.
    const attachmentId = await createUpload(user.id, file.name, "application/pdf", base64)
    const truncated = trimmed.length > MAX_TEXT_CHARS
    return jsonResponse(
      {
        attachmentId,
        name: file.name,
        pages: totalPages,
        text: truncated ? trimmed.slice(0, MAX_TEXT_CHARS) : trimmed,
        truncated,
      },
      { status: 200 },
      req
    )
  } catch {
    return jsonResponse({ error: "Couldn't read that PDF." }, { status: 422 }, req)
  }
}
