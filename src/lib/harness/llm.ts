// A small, self-contained LLM caller for Harness. Uses the same OpenCode Zen
// provider the chat route uses, but kept separate so Harness can evolve its own
// prompting without touching the chat pipeline.

const PROVIDER_URL = "https://opencode.ai/zen/v1/chat/completions"
const PROVIDER_MODEL = "deepseek-v4-flash-free"
const ENV_KEY = "OPENCODE_API_KEY"

export interface LlmMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LlmResult {
  content: string
  tokens: number
}

// Non-streaming completion. Returns "" on any failure so callers can fall back
// gracefully rather than crash the whole run.
export async function complete(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}
): Promise<LlmResult> {
  const key = process.env[ENV_KEY]
  if (!key) {
    console.error("[harness/llm] no OPENCODE_API_KEY in env")
    return { content: "", tokens: 0 }
  }

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000)
  try {
    // The OpenCode Zen free model only reliably serves STREAMING responses
    // (non-streaming returns empty), so we stream and accumulate — same as chat.
    const res = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: PROVIDER_MODEL,
        stream: true,
        temperature: opts.temperature ?? 0.5,
        // R1 spends many tokens on hidden reasoning BEFORE the answer, so give
        // it generous headroom or the visible answer never lands. Floor at 4000.
        max_tokens: Math.max(4000, opts.maxTokens ?? 1200),
        messages,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "")
      console.error(`[harness/llm] upstream ${res.status}: ${body.slice(0, 200)}`)
      return { content: "", tokens: 0 }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    let content = ""
    let reasoning = ""
    let tokens = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith("data:")) continue
        const payload = t.slice(5).trim()
        if (payload === "[DONE]") continue
        try {
          const ev = JSON.parse(payload) as {
            choices?: { delta?: { content?: string; reasoning_content?: string } }[]
            usage?: { total_tokens?: number }
          }
          const delta = ev.choices?.[0]?.delta
          if (delta?.content) content += delta.content
          // R1 is a reasoning model — it streams its thinking in reasoning_content
          // first. We keep it only as a fallback if no final content arrives.
          if (delta?.reasoning_content) reasoning += delta.reasoning_content
          if (ev.usage?.total_tokens) tokens = ev.usage.total_tokens
        } catch {
          /* skip malformed SSE line */
        }
      }
    }
    // Prefer the real answer. Only fall back to reasoning if NOTHING else came
    // back, and strip the model's "Thinking." scaffolding so it never leaks into
    // a report.
    let out = content.trim()
    if (!out && reasoning.trim()) {
      out = reasoning
        .replace(/^\s*Thinking\.?\s*/i, "")
        .replace(/^[\s\S]*?\n\n/, "") // drop the first reasoning block
        .trim()
    }
    return { content: out, tokens: tokens || Math.round(out.length / 4) }
  } catch {
    return { content: "", tokens: 0 }
  } finally {
    clearTimeout(to)
  }
}

// Pull the first JSON object/array out of a model reply, tolerating code fences
// and surrounding prose.
export function extractJson<T>(text: string): T | null {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  // find the first { or [ and matching close
  const start = raw.search(/[[{]/)
  if (start < 0) return null
  const open = raw[start]
  const close = open === "{" ? "}" : "]"
  let depth = 0
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === open) depth++
    else if (raw[i] === close) {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1)) as T
        } catch {
          return null
        }
      }
    }
  }
  return null
}
