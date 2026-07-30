// Vordex — Model Fusion engine (v1, persona-only).
// The full thesis is distinct base models × distinct personas. Until a real
// multi-model roster is wired up, v1 forces ONE model into several genuinely
// disagreeing personas, then reconciles their drafts into a single answer.
// Stages: parallel drafts → cross-critique → synthesis (streamed).

const ZEN_URL = "https://opencode.ai/zen/v1/chat/completions"

// Distinct free base models on OpenCode Zen, each matched to the persona whose
// job plays to its strength. This is the full thesis: different models, not one
// model wearing hats.
const M = {
  deepseek: "deepseek-v4-flash-free",  // ⭐ strong general — Skeptic + meta stages
  nemotron: "nemotron-3-ultra-free",   // strong reasoning — Logician
  north: "north-mini-code-free",       // lightweight coding — Engineer
  ling: "ling-3.0-flash-free",         // fast chat — Visionary
} as const

// The critique + final synthesis run on the strongest general model.
export const SYNTH_MODEL: string = M.deepseek

export interface Persona {
  key: string
  label: string
  model: string
  system: string
}

// Personas are defined as STANCES with win-conditions — so they disagree on
// substance, not just tone (per the PRD) — and each runs on a DIFFERENT model.
export const PERSONAS: Persona[] = [
  {
    key: "skeptic",
    label: "Skeptic",
    model: M.deepseek,
    system:
      "You are the Skeptic. Assume the obvious answer is wrong until proven otherwise. Attack the premise: what's missing, overclaimed, unsupported, or false? Name the strongest objection. Your win condition is exposing the flaw everyone else glosses over. Be substantive, not cynical.",
  },
  {
    key: "visionary",
    label: "Visionary",
    model: M.ling,
    system:
      "You are the Visionary. Give the ambitious, non-obvious answer. Ignore 'that's not possible.' Reach for the insight or reframe no one else dared. Your win condition is the idea that makes the others say 'I hadn't thought of that.' Be bold but concrete.",
  },
  {
    key: "logician",
    label: "Logician",
    model: M.nemotron,
    system:
      "You are the Logician. Rigor above everything. Define terms, reason step by step, check edge cases, and separate what's proven from what's assumed. Your win condition is the answer that is provably correct. If something can't be established, say so precisely.",
  },
  {
    key: "engineer",
    label: "Engineer",
    model: M.north,
    system:
      "You are the Engineer. Make it real. Constraints, tradeoffs, concrete steps, what actually works in practice versus in theory. Your win condition is the answer someone can act on today. Prefer specifics over abstractions.",
  },
]

interface Msg { role: string; content: string }

// ── Non-streaming completion (drafts + critique) ─────────────────────────────
export async function complete(
  apiKey: string,
  model: string,
  messages: Msg[],
  opts: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const t0 = Date.now()
  try {
    const r = await fetch(ZEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: opts.temperature ?? 0.8,
        max_tokens: opts.maxTokens ?? 1400,
        top_p: 1,
        messages,
      }),
      signal: opts.signal,
    })
    if (!r.ok) {
      const body = await r.text().catch(() => "")
      dbg(`complete ${model} → HTTP ${r.status} in ${Date.now() - t0}ms :: ${body.slice(0, 300)}`)
      return ""
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = j?.choices?.[0]?.message?.content ?? ""
    const out = stripThink(raw)
    dbg(`complete ${model} → ok in ${Date.now() - t0}ms, raw ${raw.length}c, stripped ${out.length}c`)
    return out
  } catch (e) {
    dbg(`complete ${model} → threw in ${Date.now() - t0}ms :: ${(e as Error)?.name}: ${(e as Error)?.message}`)
    return ""
  }
}

// Dev-only diagnostics — silent in production.
function dbg(msg: string) {
  if (process.env.NODE_ENV !== "production") console.log(`[fusion] ${msg}`)
}

// ── Streaming completion (final synthesis) ───────────────────────────────────
export async function streamCompletion(
  apiKey: string,
  model: string,
  messages: Msg[],
  onToken: (t: string) => void,
  opts: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
): Promise<string> {
  let full = ""
  const t0 = Date.now()
  try {
    const r = await fetch(ZEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: opts.temperature ?? 0.5,
        max_tokens: opts.maxTokens ?? 2400,
        top_p: 1,
        messages,
      }),
      signal: opts.signal,
    })
    if (!r.ok || !r.body) {
      const body = r.ok ? "(no body)" : await r.text().catch(() => "")
      dbg(`stream ${model} → HTTP ${r.status} in ${Date.now() - t0}ms :: ${body.slice(0, 300)}`)
      return ""
    }
    const reader = r.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith("data:")) continue
        const p = t.slice(5).trim()
        if (p === "[DONE]") continue
        try {
          const chunk = JSON.parse(p) as { choices?: { delta?: { content?: string } }[] }
          const c = chunk.choices?.[0]?.delta?.content
          if (c) { full += c; onToken(c) }
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    dbg(`stream ${model} → threw in ${Date.now() - t0}ms :: ${(e as Error)?.name}: ${(e as Error)?.message}`)
  }
  dbg(`stream ${model} → done in ${Date.now() - t0}ms, ${full.length}c`)
  return full
}

function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*/gi, "").trim()
}

// ── Prompt builders ──────────────────────────────────────────────────────────

// Trim history to the last N turns; keep only role + content.
export function context(messages: Msg[], keep = 10): Msg[] {
  return messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-keep).map((m) => ({ role: m.role, content: m.content }))
}

export function draftMessages(persona: Persona, convo: Msg[]): Msg[] {
  return [
    { role: "system", content: `${persona.system}\n\nAnswer the user's latest message from this stance. Be direct and complete. Do not mention that you are playing a role.` },
    ...convo,
  ]
}

export function critiqueMessages(convo: Msg[], drafts: { label: string; text: string }[]): Msg[] {
  const body = drafts.map((d) => `### ${d.label}\n${d.text}`).join("\n\n")
  return [
    {
      role: "system",
      content:
        "You are a rigorous critic. Below are independent drafts answering the same question from different stances. Attack their ASSUMPTIONS and CORRECTNESS — not their style. For each draft, list its 1–3 sharpest weaknesses (factual errors, unsupported claims, missed considerations). Then state the 2–4 points the drafts genuinely DISAGREE on. Be terse. This is internal analysis.",
    },
    { role: "user", content: `Question context:\n${convo.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nDrafts:\n${body}` },
  ]
}

// True all-pairs critique: one persona-model reviews EVERY OTHER draft (not its
// own), on its own model, from its own stance. Running this for each persona and
// concatenating the results gives N×(N-1) genuine cross-examinations instead of
// a single critic's pass.
export function peerCritiqueMessages(
  critic: Persona,
  convo: Msg[],
  drafts: { key: string; label: string; text: string }[]
): Msg[] {
  const others = drafts.filter((d) => d.key !== critic.key)
  const body = others.map((d) => `### ${d.label}\n${d.text}`).join("\n\n")
  return [
    {
      role: "system",
      content:
        `${critic.system}\n\nYou are now reviewing OTHER stances' drafts of the same question. From your stance, attack their ASSUMPTIONS and CORRECTNESS — not their style. For each draft, give its 1–2 sharpest weaknesses (factual errors, unsupported claims, missed considerations). Be terse. This is internal analysis; do not mention roles.`,
    },
    { role: "user", content: `Question context:\n${convo.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nOther drafts:\n${body}` },
  ]
}

export function synthesisMessages(baseSystem: string, convo: Msg[], drafts: { label: string; text: string }[], critique: string): Msg[] {
  const body = drafts.map((d) => `### ${d.label}\n${d.text}`).join("\n\n")
  return [
    {
      role: "system",
      content:
        `${baseSystem}\n\n# FUSION\nYou are producing the FINAL answer by fusing four independent drafts (Skeptic, Visionary, Logician, Engineer) and a critique of their assumptions. Keep the strengths of each and fix the errors the critique found. Resolve their disagreements in the user's favor. Write ONE clean, direct answer in your normal voice. Do NOT mention the drafts, the personas, the critique, or that any fusion happened — just give the best possible answer.`,
    },
    ...convo.slice(0, -1),
    {
      role: "user",
      content:
        `${convo[convo.length - 1]?.content ?? ""}\n\n[Internal material — do not reference it directly]\nDRAFTS:\n${body}\n\nCRITIQUE:\n${critique || "(none)"}\n\nNow write the single best answer.`,
    },
  ]
}
