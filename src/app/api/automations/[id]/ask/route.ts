import { jsonResponse, preflight, rateLimit, rateLimitKey } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { getAutomation, listAutomationEvents } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ZEN_URL = "https://opencode.ai/zen/v1/chat/completions"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// "Ask Simplicity" — answer questions over an automation's own activity history.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const { id } = await ctx.params
  const a = await getAutomation(id, user.id)
  if (!a) return jsonResponse({ error: "Not found" }, { status: 404 }, req)

  const rl = rateLimit(rateLimitKey("auto-ask", req, user.id), 20, 60_000)
  if (!rl.ok) return jsonResponse({ error: "Too many requests" }, { status: 429 }, req)

  let body: { question?: string }
  try { body = await req.json() } catch { return jsonResponse({ error: "Invalid body" }, { status: 400 }, req) }
  const question = String(body.question ?? "").trim()
  if (!question) return jsonResponse({ error: "Ask a question." }, { status: 400 }, req)

  const apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) return jsonResponse({ error: "AI not configured" }, { status: 500 }, req)

  const events = await listAutomationEvents(id, 200)
  const stats = (() => { try { return JSON.parse(a.stats) } catch { return {} } })()
  const log = events
    .slice(0, 120)
    .map((e) => `${new Date(e.ts).toISOString()} [${e.status}] ${e.title}`)
    .join("\n")

  const sys = `You are Simplicity, reporting on a background automation named "${a.name}".
Its standing instruction: "${a.prompt}".
Lifetime stats: ${JSON.stringify(stats)}.
Recent activity log (newest first):
${log || "(no activity yet)"}

Answer the user's question about what this automation has done, concisely and factually, based ONLY on the log and stats above. If the log doesn't contain the answer, say so plainly. Do not invent actions.`

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 45_000)
  try {
    const r = await fetch(ZEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash-free",
        stream: false,
        temperature: 0.3,
        max_tokens: 700,
        messages: [{ role: "system", content: sys }, { role: "user", content: question }],
      }),
      signal: ctrl.signal,
    })
    if (!r.ok) return jsonResponse({ error: "AI error" }, { status: 502 }, req)
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    let answer = j?.choices?.[0]?.message?.content ?? ""
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*/gi, "").trim()
    return jsonResponse({ answer: answer || "I don't have anything on that yet." }, { status: 200 }, req)
  } catch {
    return jsonResponse({ error: "Timed out" }, { status: 504 }, req)
  } finally {
    clearTimeout(to)
  }
}
