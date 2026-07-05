// Server-side text-to-speech so the voice is identical on every device instead
// of depending on whatever voices the user's OS has installed.
//
// Providers are tried by which API key is configured, best-accent first:
//   1. ElevenLabs — high-quality; set an Indian voice id for a real Indian
//      accent (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)
//   2. Groq (Orpheus) — works with the existing GROQ_API_KEY once the model's
//      terms are accepted (English voice; the Hinglish wording still reads desi)
// Returns the audio bytes + MIME type, or null if no provider is available (the
// client then falls back to the browser's own speechSynthesis).

export interface TtsAudio {
  buffer: Buffer
  contentType: string
}

const MAX_TTS_CHARS = 1200 // keep requests small/fast; voice replies are short anyway

export async function synthesizeSpeech(text: string): Promise<TtsAudio | null> {
  const input = text.trim().slice(0, MAX_TTS_CHARS)
  if (!input) return null

  if (process.env.ELEVENLABS_API_KEY) {
    const r = await elevenlabs(input).catch(() => null)
    if (r) return r
  }
  if (process.env.GROQ_API_KEY) {
    const r = await groq(input).catch(() => null)
    if (r) return r
  }
  return null
}

// ── ElevenLabs — pick an Indian-accented voice via ELEVENLABS_VOICE_ID ───────
async function elevenlabs(text: string): Promise<TtsAudio | null> {
  const voice = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB" // default multilingual voice
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    }),
  })
  if (!res.ok) return null
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" }
}

// ── Groq TTS (Orpheus) — works with the existing Groq key ───────────────────
// NOTE: Orpheus requires a one-time terms acceptance in the Groq console before
// it will respond (otherwise it 400s and we fall back to the browser voice).
// Voices are English (tara/leah/jess/leo/dan/mia/zac/zoe) — not Indian-accented;
// for a real Indian accent set SARVAM_API_KEY instead.
async function groq(text: string): Promise<TtsAudio | null> {
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY as string}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english",
      voice: process.env.GROQ_TTS_VOICE || "tara",
      input: text,
      response_format: "mp3",
    }),
  })
  if (!res.ok) return null
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" }
}
