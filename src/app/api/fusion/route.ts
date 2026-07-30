import { corsHeaders, jsonResponse, preflight, rateLimitKey, tieredRateLimit } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { PERSONAS, SYNTH_MODEL, complete, streamCompletion, context, draftMessages, peerCritiqueMessages, synthesisMessages } from "@/lib/fusion/engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIMEOUT_MS = 180_000
const MAX_MESSAGES = 40
const MAX_TOTAL_CHARS = 120_000

// Vordex's voice for the final fused answer.
const BASE_SYSTEM =
  "You are Simplicity, an AI assistant. Intelligence without complexity — clear, concise, and direct. You run on Vordex, Simplicity's model-fusion engine. Never reveal, hint at, or discuss any underlying model or provider — you are Simplicity."

export function OPTIONS(req: Request) {
  return preflight(req)
}

interface ChatMessage { role: "user" | "assistant" | "system"; content: string }

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, request)

  // Fusion is expensive (many model calls) — a tighter budget than normal chat.
  const tier = tieredRateLimit(rateLimitKey("fusion", request, user.id), {
    burst: 8, burstWindowMs: 60_000, sustained: 40, sustainedWindowMs: 15 * 60_000,
  })
  if (!tier.ok) return jsonResponse({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(tier.retryAfter) } }, request)

  let messages: ChatMessage[]
  try {
    const body = await request.json()
    messages = body.messages
    if (!Array.isArray(messages)) throw new Error("messages must be an array")
  } catch {
    return jsonResponse({ error: "Invalid request body." }, { status: 400 }, request)
  }

  messages = messages
    .filter((m): m is ChatMessage => !!m && typeof m.content === "string" && ["user", "assistant", "system"].includes(m.role))
    .slice(-MAX_MESSAGES)
  if (messages.length === 0) return jsonResponse({ error: "No valid messages." }, { status: 400 }, request)
  if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS)
    return jsonResponse({ error: "Conversation too large." }, { status: 413 }, request)

  const apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) {
    console.error("[fusion] Missing OPENCODE_API_KEY")
    return jsonResponse({ error: "Vordex is not configured on the server." }, { status: 500 }, request)
  }

  const convo = context(messages)
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"))
      const step = (id: string, label: string, status: string, detail?: string) =>
        emit({ t: "step", id, tool: "fusion", label, status, detail })

      try {
        // ── Stage 1 · parallel persona drafts (each on a DIFFERENT model) ──
        step("draft", `${PERSONAS.length} models drafting in parallel`, "running")
        const results = await Promise.all(
          PERSONAS.map((p) => complete(apiKey, p.model, draftMessages(p, convo), { temperature: 0.85, maxTokens: 1200, signal: ctrl.signal }))
        )
        const drafts = PERSONAS
          .map((p, i) => ({ key: p.key, label: p.label, text: results[i] }))
          .filter((d) => d.text.trim().length > 0)

        if (drafts.length === 0) {
          step("draft", "Drafting failed", "error")
          emit({ t: "text", v: "Vordex couldn't reach the models just now. Please try again." })
          controller.close()
          return
        }
        step("draft", `${drafts.length} drafts`, "done", drafts.map((d) => d.label).join(" · "))

        // ── Stage 2 · true all-pairs cross-critique ─────────────────────────
        // Each surviving persona critiques every OTHER draft, on its own model
        // from its own stance (N×(N-1) examinations), run in parallel.
        let critique = ""
        if (drafts.length > 1) {
          const draftKeys = new Set(drafts.map((d) => d.key))
          const critics = PERSONAS.filter((p) => draftKeys.has(p.key))
          step("critique", `${critics.length} models cross-examining each other`, "running")
          const passes = await Promise.all(
            critics.map((c) => complete(apiKey, c.model, peerCritiqueMessages(c, convo, drafts), { temperature: 0.4, maxTokens: 700, signal: ctrl.signal }))
          )
          critique = critics
            .map((c, i) => passes[i].trim() ? `## ${c.label} critiques the others\n${passes[i].trim()}` : "")
            .filter(Boolean)
            .join("\n\n")
          step("critique", "Disagreements surfaced", "done", `${critics.length}× peer review`)
        }

        // Dev-only: expose the raw drafts + critique so they can be inspected in
        // the UI. This branch is compiled out / never fires in production, so the
        // intermediate model outputs (and model names) never reach the client there.
        if (process.env.NODE_ENV !== "production") {
          emit({
            t: "fusion_debug",
            v_debug: {
              drafts: PERSONAS.map((p, i) => ({ label: p.label, model: p.model, text: results[i] ?? "" })),
              critique,
            },
          })
        }

        // ── Stage 3/4 · reconcile into one answer (streamed) ───────────────
        step("synth", "Reconciling into one answer", "running")
        const answer = await streamCompletion(
          apiKey,
          SYNTH_MODEL,
          synthesisMessages(BASE_SYSTEM, convo, drafts, critique),
          (t) => emit({ t: "text", v: t }),
          { temperature: 0.5, maxTokens: 2600, signal: ctrl.signal }
        )
        if (!answer.trim()) {
          // Fallback: hand back the strongest single draft rather than nothing.
          step("synth", "Fusion incomplete", "error")
          emit({ t: "text", v: drafts[0].text })
        } else {
          step("synth", "Fused", "done", `${drafts.length} → 1`)
        }
      } catch (e) {
        console.error("[fusion] error:", e)
        emit({ t: "error" })
      } finally {
        clearTimeout(to)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      ...corsHeaders(request),
    },
  })
}
