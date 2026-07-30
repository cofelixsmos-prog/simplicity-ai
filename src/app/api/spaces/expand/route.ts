import { jsonResponse, preflight, rateLimit, rateLimitKey } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RATE_LIMIT = 30
const RATE_WINDOW = 60_000
const TIMEOUT_MS = 30_000

export function OPTIONS(req: Request) {
  return preflight(req)
}

function extractJsonArray(raw: string): string[] | null {
  let text = raw
  // Strip <think>…</think> blocks (DeepSeek reasoning wrapper)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "")
  // Strip markdown code fences
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "")
  text = text.trim()

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[0])
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((x) => String(x).trim()).filter(Boolean)
    }
  } catch { /* fall through */ }
  return null
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const rl = rateLimit(rateLimitKey("spaces", req), RATE_LIMIT, RATE_WINDOW)
  if (!rl.ok) return jsonResponse({ error: "Too many requests" }, { status: 429 }, req)

  let body: { topic: string; parent?: string; siblings?: string[] }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid body" }, { status: 400 }, req)
  }

  const topic = String(body.topic ?? "").trim()
  if (!topic) return jsonResponse({ error: "Topic required" }, { status: 400 }, req)

  const parent = body.parent ? String(body.parent).trim() : null
  const siblings = Array.isArray(body.siblings) ? body.siblings.map(String) : []

  const prompt = parent
    ? `The user is exploring a mind map. The central topic is "${topic}". They clicked on the node "${parent}"${siblings.length ? ` (sibling nodes: ${siblings.join(", ")})` : ""}. Generate exactly 4-6 short sub-topic branches that expand on "${parent}" in the context of "${topic}". Each branch should be 1-4 words, specific, and interesting — not generic. Return ONLY a JSON array of strings, no other text.`
    : `Generate the initial branches of a mind map about "${topic}". Create exactly 5-7 branches that cover the most interesting and important aspects. Each branch should be 1-4 words, specific, and thought-provoking — not generic. Return ONLY a JSON array of strings, no other text.`

  const apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) return jsonResponse({ error: "AI not configured" }, { status: 500 }, req)

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  try {
    const r = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash-free",
        stream: false,
        temperature: 0.8,
        max_tokens: 1024,
        top_p: 1,
        messages: [
          { role: "system", content: "You generate mind map branches. Return ONLY a JSON array of short strings. No markdown, no explanation, no code fences, no thinking tags." },
          { role: "user", content: prompt },
        ],
      }),
      signal: ctrl.signal,
    })

    if (!r.ok) {
      console.error(`[spaces] upstream ${r.status}`)
      return jsonResponse({ error: "AI error" }, { status: 502 }, req)
    }

    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = j?.choices?.[0]?.message?.content ?? ""

    const branches = extractJsonArray(raw)
    if (!branches) {
      console.error("[spaces] could not parse:", raw.slice(0, 500))
      return jsonResponse({ error: "Bad AI response" }, { status: 502 }, req)
    }

    return jsonResponse({ branches: branches.slice(0, 7) }, { status: 200 }, req)
  } catch {
    return jsonResponse({ error: "AI timed out" }, { status: 504 }, req)
  } finally {
    clearTimeout(to)
  }
}
