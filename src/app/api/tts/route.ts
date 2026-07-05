import { corsHeaders, preflight, jsonResponse, clientIp, rateLimit } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { synthesizeSpeech } from "@/lib/tts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Turn text into speech audio on the server. Returns the audio bytes, or 501 if
// no TTS provider is configured (the client then falls back to browser speech).
export async function POST(req: Request) {
  const rl = rateLimit(`tts:${clientIp(req)}`, 40, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests." }, { status: 429 }, req)

  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  let text = ""
  try {
    text = String(((await req.json()) as { text?: unknown }).text ?? "")
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }
  if (!text.trim()) return jsonResponse({ error: "No text." }, { status: 400 }, req)

  const audio = await synthesizeSpeech(text).catch(() => null)
  if (!audio) return jsonResponse({ error: "No TTS provider configured." }, { status: 501 }, req)

  return new Response(new Uint8Array(audio.buffer), {
    status: 200,
    headers: {
      "Content-Type": audio.contentType,
      "Cache-Control": "no-store",
      ...corsHeaders(req),
    },
  })
}
