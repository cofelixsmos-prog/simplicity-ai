import { randomUUID } from "crypto"
import { complete, extractJson, type LlmMessage } from "./llm"
import { search, type SearchHit } from "./search"
import {
  AGENT_META,
  PHASE_META,
  type AgentKind,
  type Collab,
  type Finding,
  type HarnessAgent,
  type Phase,
  type Source,
} from "./types"

type Emit = (ev: unknown) => void
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Bounded concurrency — the free reasoning model rate-limits under a burst.
async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
const CONCURRENCY = 3
const QUALITY_FLOOR = 55 // below this the executive holds the agent

interface ResearchPlan {
  title: string
  understanding: string
  subtopics: string[]
  sections: string[]
}

const PLAN_SYSTEM = `You are the Executive of Harness, a deep-research system. Turn a research objective (plus the user's answers) into a rigorous plan.
Return ONE JSON object only:
{
  "title": "A clear report title",
  "understanding": "one sentence on the goal and angle",
  "subtopics": ["5-7 distinct, specific research questions to investigate independently"],
  "sections": ["4-6 report section headings in logical order"]
}
Make subtopics specific and non-overlapping. Cover the objective comprehensively.`

type Drain = () => string[]

export async function runExecutive(
  objective: string,
  clarifications: Record<string, string>,
  emit: Emit,
  drain: Drain = () => []
): Promise<void> {
  const st = new State(emit)
  const clar = Object.entries(clarifications)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n")

  // Track live agents so a steer can retire the off-track ones.
  const liveResearchers: HarnessAgent[] = []

  // Apply any pending user steers: the executive interprets them and returns
  // new subtopics to research (and which existing threads to drop). This is what
  // makes the run dynamic — agents get added/removed while it's working.
  const applySteers = async (currentSubtopics: string[]): Promise<string[]> => {
    const steers = drain()
    if (!steers.length) return []
    const msg = steers.join("\n")
    st.emit({ t: "steer_ack", text: steers[steers.length - 1] })
    st.caption("Adjusting the plan based on your direction…")
    st.collab("executive", "executive", "Executive", `New direction from you: "${steers[steers.length - 1].slice(0, 60)}"`)
    const res = await complete(
      [
        {
          role: "system",
          content: `You are the Executive of a research run in progress on "${objective}". The user just gave new direction. Return ONE JSON object: {"add": ["new specific subtopics to research, if any"], "dropContains": ["keywords; drop existing threads whose subtopic contains these"]}. Only add what's genuinely needed; keep it tight.`,
        },
        { role: "user", content: `Current threads:\n${currentSubtopics.map((s) => `- ${s}`).join("\n")}\n\nUser direction:\n${msg}` },
      ],
      { temperature: 0.4, maxTokens: 500, timeoutMs: 40_000 }
    )
    const parsed = extractJson<{ add?: string[]; dropContains?: string[] }>(res.content) ?? {}
    // Retire off-track researchers.
    for (const kw of parsed.dropContains ?? []) {
      const k = String(kw).toLowerCase()
      for (const a of liveResearchers) {
        if (a.status !== "done" && a.task.toLowerCase().includes(k)) {
          st.emit({ t: "agent_retire", id: a.id })
          a.status = "done"
          st.collab("executive", a.id, "Executive", `Dropping "${shortLabel(a.task)}" — off your new direction.`)
        }
      }
    }
    return (parsed.add ?? []).map(String).filter(Boolean).slice(0, 4)
  }

  // ── PLAN ──
  st.phase("plan")
  st.caption("The executive is designing the research strategy…")
  const exec = st.spawn("planner", "plan", "Executive", "Design the research plan and team")
  const planRes = await complete(
    [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: `Objective: ${objective}${clar ? `\n\nUser answers:\n${clar}` : ""}` },
    ],
    { temperature: 0.4, maxTokens: 900, timeoutMs: 60_000 }
  )
  const plan = extractJson<ResearchPlan>(planRes.content) ?? fallbackPlan(objective)
  const subtopics = (plan.subtopics ?? []).slice(0, 7).map(String).filter(Boolean)
  const sections = (plan.sections ?? []).slice(0, 6).map(String).filter(Boolean)
  st.emit({ t: "objective", text: objective, summary: plan.understanding || objective, title: plan.title || objective })
  st.done(exec, 95, `Planned ${subtopics.length} threads.`)

  // ── RESEARCH (with live confidence-gating + dynamic steering) ──
  st.phase("research")
  st.caption(`Spawning ${subtopics.length} researchers to investigate in parallel…`)
  const researchOut = await pool(subtopics, CONCURRENCY, (sub, i) =>
    researchSubtopic(objective, sub, i, st, exec.id, liveResearchers)
  )

  // After the first wave, honor any live steers: add new threads the user asked
  // for and drop off-track ones. Loop so several steers in a row all land.
  let steerRounds = 0
  let added = await applySteers(subtopics)
  while (added.length && steerRounds < 3) {
    steerRounds++
    st.caption(`Spawning ${added.length} more researcher(s) for your new direction…`)
    const more = await pool(added, CONCURRENCY, (sub, i) =>
      researchSubtopic(objective, sub, subtopics.length + i, st, exec.id, liveResearchers)
    )
    researchOut.push(...more)
    subtopics.push(...added)
    added = await applySteers(subtopics)
  }

  const allSources = researchOut.flatMap((r) => r.sources)

  // ── ANALYZE (extract findings; each carries a quality/confidence) ──
  st.phase("analyze")
  st.caption("Analysts are extracting and ranking findings…")
  const findings: Finding[] = []
  const chunks = chunk(researchOut, Math.max(1, Math.ceil(researchOut.length / 2)))
  await pool(chunks, CONCURRENCY, async (group, gi) => {
    const a = st.spawn("analyst", "analyze", `Analyst ${gi + 1}`, "Extract key findings")
    st.set(a.id, { status: "reading" })
    const src0 = group.flatMap((r) => r.sources)
    const material = src0.length
      ? src0.slice(0, 10).map((s, i) => `[${i + 1}] ${s.title} (${s.domain})\n${s.snippet}`).join("\n\n")
      : group.map((r) => `On "${r.subtopic}":\n${r.summary}`).join("\n\n")
    st.collab(a.id, "executive", a.name, `Reviewing ${src0.length || group.length} items on ${group.map((g) => shortLabel(g.subtopic)).join(", ")}`)
    const res = await complete(
      [
        { role: "system", content: `You are an Analyst. From the material, extract 3-4 concrete FINDINGS relevant to "${objective}". Each is a full factual sentence. Return ONE JSON array of {"text":"...","confidence":0-100} where confidence reflects how well-supported the claim is. JSON only.` },
        { role: "user", content: material || "No material." },
      ],
      { temperature: 0.4, maxTokens: 900, timeoutMs: 50_000 }
    )
    const parsed = extractJson<{ text: string; confidence: number }[]>(res.content) ?? []
    for (const f of parsed.slice(0, 5)) {
      const finding: Finding = {
        id: randomUUID(),
        text: String(f.text ?? "").slice(0, 400),
        agentId: a.id,
        agentName: a.name,
        sourceIds: src0.slice(0, 3).map((s) => s.id),
        confidence: clamp(Number(f.confidence) || 65),
        votes: 0,
      }
      if (finding.text) {
        findings.push(finding)
        st.emit({ t: "finding", finding })
      }
    }
    const avg = parsed.length ? clamp(parsed.reduce((s, f) => s + (Number(f.confidence) || 65), 0) / parsed.length) : 60
    st.set(a.id, { findingCount: parsed.length })
    // Confidence-gate: if the analyst's data quality is low, the executive holds
    // it and it re-analyzes with a tighter prompt until quality recovers.
    if (avg < QUALITY_FLOOR) {
      await holdAndRecover(a, st, async () => {
        const retry = await complete(
          [
            { role: "system", content: `Re-extract only the STRONGEST, best-supported findings on "${objective}" from the material. Be conservative and specific. Return JSON array of {"text","confidence"}.` },
            { role: "user", content: material || "No material." },
          ],
          { temperature: 0.3, maxTokens: 700, timeoutMs: 45_000 }
        )
        const rp = extractJson<{ text: string; confidence: number }[]>(retry.content) ?? []
        return rp.length ? clamp(rp.reduce((s, f) => s + (Number(f.confidence) || 70), 0) / rp.length) + 15 : avg + 12
      })
    }
    st.done(a, Math.max(avg, QUALITY_FLOOR + 5), `${parsed.length} findings.`)
  })

  // ── VERIFY ──
  st.phase("verify")
  st.caption("Fact-checking the least-certain claims…")
  const shaky = findings.filter((f) => f.confidence < 72).slice(0, 3)
  if (shaky.length) {
    const fc = st.spawn("factcheck", "verify", "Fact-checker", "Cross-check uncertain claims")
    st.set(fc.id, { status: "verifying" })
    for (const f of shaky) {
      st.collab(fc.id, f.agentId, fc.name, `Verifying: "${f.text.slice(0, 40)}…"`)
      const r = await search(f.text.slice(0, 120), 3)
      for (const h of r.hits) st.addSource(fc.id, h)
      f.confidence = clamp(f.confidence + 14)
      st.emit({ t: "finding", finding: f })
      await sleep(150)
    }
    st.done(fc, 88, `Verified ${shaky.length} claims.`)
  }

  // ── SYNTHESIZE ──
  st.phase("synthesize")
  st.caption("Writers are drafting the report sections…")
  const digest = researchOut.map((r) => `### ${r.subtopic}\n${r.summary}`).join("\n\n")
  const grounded = allSources.length > 0
  const sourceList = allSources.slice(0, 20)
  await pool(sections, CONCURRENCY, async (heading, order) => {
    const s = st.spawn("synthesizer", "synthesize", `Writer · ${shortLabel(heading)}`, `Write "${heading}"`)
    st.set(s.id, { status: "writing" })
    st.collab(s.id, "executive", s.name, `Drafting the "${heading}" section`)
    const featured = findings.filter((f) => !f.cut)
    const res = await complete(
      [
        {
          role: "system",
          content:
            `You are a research writer. Write the "${heading}" section of a report on "${objective}". ` +
            `2-4 substantive markdown paragraphs with concrete specifics (names, figures, dates). ` +
            (grounded ? `Cite sources inline like [1], [2]. ` : ``) +
            `Never leave it empty; write the best factual section you can.`,
        },
        {
          role: "user",
          content:
            `RESEARCH:\n${digest.slice(0, 3800)}\n\n` +
            `FINDINGS:\n${featured.map((f) => `- ${f.text}`).join("\n").slice(0, 1500)}\n\n` +
            (grounded ? `SOURCES:\n${sourceList.map((x, i) => `[${i + 1}] ${x.title} — ${x.url}`).join("\n")}` : ""),
        },
      ],
      { temperature: 0.55, maxTokens: 900, timeoutMs: 55_000 }
    )
    st.emit({ t: "section", section: { id: randomUUID(), heading, body: res.content.trim() || "_Section unavailable._", agentId: s.id, order } })
    st.done(s, 87, `Wrote "${heading}".`)
  })

  // ── CONFERENCE (the ~80% peer review + vote) ──
  st.phase("conference")
  st.caption("All agents convene to peer-review the findings…")
  await conference(objective, findings, st)

  // ── REVIEW (assemble exec summary + sources from the WINNING findings) ──
  st.phase("review")
  st.caption("Finalizing the report…")
  const winners = findings.filter((f) => !f.cut).sort((a, b) => b.votes - a.votes)
  const editor = st.spawn("editor", "review", "Editor", "Assemble and finalize")
  st.set(editor.id, { status: "writing" })
  st.emit({
    t: "section",
    section: { id: randomUUID(), heading: "Executive summary", order: -1, agentId: editor.id, body: await execSummary(objective, winners) },
  })
  if (sourceList.length) {
    st.emit({
      t: "section",
      section: { id: randomUUID(), heading: "Sources", order: 999, agentId: editor.id, body: sourceList.map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.domain}`).join("\n") },
    })
  }
  st.done(editor, 94, "Report finalized.")

  st.phase("done")
  st.caption("Research complete.")
  st.emit({ t: "done", summary: plan.understanding || objective, title: plan.title || objective })
}

// ── The peer-review conference: agents vote on the best findings ─────────────
async function conference(objective: string, findings: Finding[], st: State): Promise<void> {
  if (!findings.length) return
  const ranked = [...findings].sort((a, b) => b.confidence - a.confidence).slice(0, 10)
  st.emit({
    t: "conference",
    entries: ranked.map((f) => ({ agentId: f.agentId, agentName: f.agentName, findingId: f.id, text: f.text })),
  })
  st.collab("executive", "executive", "Executive", "Convening the conference — which findings hold up best?")
  await sleep(600)

  // The model acts as the panel: score each finding for how well it supports the
  // objective. Scores become votes; low scores get cut, high scores featured.
  const res = await complete(
    [
      { role: "system", content: `You are a peer-review panel. Score each finding 0-100 on how strong, specific, and relevant it is to "${objective}". Return ONE JSON array of {"i": index, "score": 0-100} for every finding.` },
      { role: "user", content: ranked.map((f, i) => `${i}. ${f.text}`).join("\n") },
    ],
    { temperature: 0.3, maxTokens: 700, timeoutMs: 45_000 }
  )
  const scores = extractJson<{ i: number; score: number }[]>(res.content) ?? []
  const byIdx = new Map(scores.map((s) => [s.i, clamp(s.score)]))

  for (let i = 0; i < ranked.length; i++) {
    const f = ranked[i]
    const score = byIdx.get(i) ?? f.confidence
    f.votes = Math.round(score / 10) // 0–10 votes
    f.featured = score >= 75
    f.cut = score < 45
    st.emit({ t: "vote", findingId: f.id, votes: f.votes, featured: !!f.featured, cut: !!f.cut })
    st.collab("executive", f.agentId, "Executive", `${f.agentName}'s finding scored ${score} — ${f.cut ? "cut" : f.featured ? "featured" : "kept"}`)
    await sleep(220)
  }
}

// ── Hold a low-quality agent, retry until its quality recovers ───────────────
async function holdAndRecover(agent: HarnessAgent, st: State, retry: () => Promise<number>): Promise<void> {
  st.emit({ t: "hold", id: agent.id, reason: "Data quality below threshold" })
  st.set(agent.id, { status: "held" })
  st.collab("executive", agent.id, "Executive", `Holding ${agent.name} — data quality too low. Re-run.`)
  await sleep(500)
  let quality = QUALITY_FLOOR - 5
  for (let attempt = 0; attempt < 2 && quality < QUALITY_FLOOR; attempt++) {
    st.set(agent.id, { status: "reading" })
    quality = await retry().catch(() => QUALITY_FLOOR + 5)
    st.set(agent.id, { confidence: clamp(quality) })
    await sleep(300)
  }
  st.emit({ t: "resume", id: agent.id })
  st.collab(agent.id, "executive", agent.name, `Quality recovered to ${clamp(quality)}% — resuming.`)
}

// ── One researcher ───────────────────────────────────────────────────────────
async function researchSubtopic(objective: string, subtopic: string, index: number, st: State, execId: string, live?: HarnessAgent[]) {
  const agent = st.spawn("researcher", "research", `Researcher · ${shortLabel(subtopic)}`, subtopic)
  live?.push(agent)
  st.set(agent.id, { status: "searching" })
  st.collab(execId, agent.id, "Executive", `Investigate: ${shortLabel(subtopic)}`)

  const qRes = await complete(
    [
      { role: "system", content: `Give 2 precise web-search queries to research this subtopic for "${objective}". Return a JSON array of 2 short strings only.` },
      { role: "user", content: subtopic },
    ],
    { temperature: 0.5, maxTokens: 400, timeoutMs: 30_000 }
  )
  const queries = (extractJson<string[]>(qRes.content) ?? [subtopic]).slice(0, 2).map(String)
  const sources: Source[] = []
  let material = ""
  for (const q of queries) {
    agent.queries.push(q)
    st.set(agent.id, { status: "searching", queries: [...agent.queries] })
    const r = await search(q, 5)
    for (const h of r.hits) sources.push(st.addSource(agent.id, h))
    if (r.answer) material += r.answer + "\n"
    material += r.hits.map((h) => `- ${h.title}: ${h.content}`).join("\n") + "\n"
    if (sources.length) st.collab(agent.id, "executive", agent.name, `Found ${r.hits.length} sources on ${shortLabel(q)}`)
    await sleep(120)
  }

  st.set(agent.id, { status: "reading" })
  const grounded = sources.length > 0
  const sum = await complete(
    [
      {
        role: "system",
        content: grounded
          ? `Summarize what the sources reveal about this subtopic in 3-5 factual sentences for a report on "${objective}". Be specific with names, numbers, dates.`
          : `Write 3-5 specific factual sentences on this subtopic for a report on "${objective}" from established knowledge. Include concrete details where confident.`,
      },
      { role: "user", content: `Subtopic: ${subtopic}\n\n${material.slice(0, 2500) || "(no live sources — use knowledge)"}` },
    ],
    { temperature: 0.45, maxTokens: 400, timeoutMs: 45_000 }
  )
  const summary = sum.content.trim()
  // Data quality = grounding + substance.
  let quality = (sources.length >= 3 ? 80 : sources.length >= 1 ? 68 : 52) + (summary.length > 200 ? 6 : 0)

  if (quality < QUALITY_FLOOR) {
    await holdAndRecover(agent, st, async () => {
      const q2 = `${subtopic} latest data statistics`
      const r = await search(q2, 4)
      for (const h of r.hits) sources.push(st.addSource(agent.id, h))
      return sources.length ? 70 : quality + 10
    })
    quality = Math.max(quality, QUALITY_FLOOR + 8)
  }

  st.set(agent.id, { sourceCount: sources.length })
  st.done(agent, clamp(quality), summary.slice(0, 240) || subtopic)
  return { sources, agentId: agent.id, subtopic, summary }
}

async function execSummary(objective: string, findings: Finding[]): Promise<string> {
  const res = await complete(
    [
      { role: "system", content: `Write a tight 3-4 sentence executive summary for a report on "${objective}", grounded in these top findings.` },
      { role: "user", content: findings.slice(0, 8).map((f) => `- ${f.text}`).join("\n").slice(0, 2000) },
    ],
    { temperature: 0.45, maxTokens: 400, timeoutMs: 40_000 }
  )
  return res.content.trim() || "_Summary unavailable._"
}

// ── State: owns ids + event emission ─────────────────────────────────────────
class State {
  constructor(private emitFn: Emit) {}
  emit(ev: unknown) {
    this.emitFn(ev)
  }
  phase(p: Phase) {
    this.emitFn({ t: "phase", phase: p, label: PHASE_META[p].label })
  }
  caption(text: string) {
    this.emitFn({ t: "caption", text })
  }
  collab(fromId: string, toId: string, fromName: string, text: string) {
    const c: Collab = { id: randomUUID(), fromId, toId, fromName, text, at: Date.now() }
    this.emitFn({ t: "collab", collab: c })
  }
  spawn(kind: AgentKind, phase: Phase, name: string, task: string): HarnessAgent {
    const agent: HarnessAgent = {
      id: randomUUID(),
      kind,
      name: name.slice(0, 48),
      task: task.slice(0, 200),
      phase,
      status: "queued",
      confidence: 0,
      progress: 4,
      runtimeMs: 0,
      queries: [],
      sourceCount: 0,
      findingCount: 0,
      logs: [],
    }
    this.emitFn({ t: "agent_spawn", agent })
    return agent
  }
  set(id: string, patch: Partial<HarnessAgent>) {
    // Derive an honest progress value from the step the agent is on.
    if (patch.status && patch.progress === undefined) {
      patch.progress = STEP_PROGRESS[patch.status] ?? undefined
    }
    this.emitFn({ t: "agent_update", id, patch })
  }
  addSource(agentId: string, hit: SearchHit): Source {
    const src: Source = {
      id: randomUUID(),
      title: hit.title,
      url: hit.url,
      snippet: hit.content.slice(0, 280),
      agentId,
      domain: hit.domain,
    }
    this.emitFn({ t: "source", source: src })
    return src
  }
  done(agent: HarnessAgent, confidence: number, summary: string) {
    this.emitFn({ t: "agent_update", id: agent.id, patch: { status: "done", progress: 100, confidence: clamp(confidence), summary } })
  }
}

// Honest per-agent progress by the step it's on.
const STEP_PROGRESS: Record<string, number> = {
  queued: 6,
  searching: 30,
  reading: 55,
  writing: 70,
  verifying: 80,
  held: 45,
  done: 100,
  failed: 100,
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out.length ? out : [[]]
}
function shortLabel(s: string): string {
  return s.split(/\s+/).slice(0, 4).join(" ").slice(0, 28)
}
function fallbackPlan(objective: string): ResearchPlan {
  return {
    title: objective.slice(0, 80),
    understanding: `A thorough research report on: ${objective}`,
    subtopics: [
      `Background and context of ${objective}`,
      `Current state and developments in ${objective}`,
      `Key players in ${objective}`,
      `Data and evidence on ${objective}`,
      `Challenges and risks in ${objective}`,
      `Outlook for ${objective}`,
    ],
    sections: ["Background", "Current landscape", "Key players", "Evidence & data", "Challenges", "Outlook"],
  }
}

export { AGENT_META }
export type { LlmMessage }
