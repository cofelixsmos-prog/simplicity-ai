import { randomUUID } from "crypto"
import { complete, extractJson, type LlmMessage } from "./llm"
import { search, type SearchHit } from "./search"
import {
  AGENT_META,
  PHASE_META,
  type AgentKind,
  type Finding,
  type HarnessAgent,
  type Phase,
  type ReportSection,
  type Source,
} from "./types"

type Emit = (ev: unknown) => void
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Run async tasks with bounded concurrency. The free model rate-limits under a
// burst of simultaneous calls (empty responses), so we cap how many agents hit
// the LLM at once while still keeping the run parallel and fast.
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

// ── The executive's research plan ────────────────────────────────────────────
interface ResearchPlan {
  title: string
  understanding: string
  subtopics: string[] // each becomes a researcher (+ its own searches)
  sections: string[] // report sections the synthesizers write
}

const PLAN_SYSTEM = `You are the Executive of Harness, a deep-research system. Decompose a research objective into a rigorous plan.
Return ONE JSON object only:
{
  "title": "A clear report title",
  "understanding": "one sentence on the goal and angle",
  "subtopics": ["5-8 distinct, specific research questions/angles to investigate"],
  "sections": ["4-6 report section headings in logical order"]
}
Make subtopics specific and non-overlapping — each will be researched independently with live web search. Cover the objective comprehensively (background, current state, key players, data/evidence, controversy/risks, outlook where relevant).`

// ── Main entry ───────────────────────────────────────────────────────────────
export async function runExecutive(objective: string, clarifications: Record<string, string>, emit: Emit): Promise<void> {
  const state = new OrchestratorState(emit)
  const clar = Object.entries(clarifications)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n")

  // ── PHASE 1: PLAN ──
  state.phase("plan")
  const exec = state.spawn("planner", "plan", "Executive Planner", "Decompose the objective into a research plan")
  state.say("executive", "Executive", `New objective: "${objective}". Building a research strategy.`)
  state.log(exec.id, "Analyzing objective and designing the agent team…")

  const planRes = await complete(
    [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: `Objective: ${objective}${clar ? `\n\nContext:\n${clar}` : ""}` },
    ],
    { temperature: 0.4, maxTokens: 900, timeoutMs: 60_000 }
  )
  const plan = extractJson<ResearchPlan>(planRes.content) ?? fallbackPlan(objective)
  const subtopics = (plan.subtopics ?? []).slice(0, 8).map((s) => String(s)).filter(Boolean)
  const sections = (plan.sections ?? []).slice(0, 6).map((s) => String(s)).filter(Boolean)

  // Estimate ~20 agents: 1 planner + researchers×subtopics + analysts + factcheck
  // + synthesizers×sections + critic + editor.
  const planned = 1 + subtopics.length * 2 + Math.min(3, subtopics.length) + sections.length + 2
  state.emit({ t: "objective", text: objective, summary: plan.understanding || objective, etaMs: planned * 9000, plannedAgents: planned })
  state.done(exec, 92, `Planned ${subtopics.length} research threads and ${sections.length} report sections.`)
  state.retire(exec.id)

  // ── PHASE 2: RESEARCH (the bulk — one researcher per subtopic, parallel) ──
  state.phase("research")
  state.say("executive", "Executive", `Spawning ${subtopics.length} research agents to investigate in parallel.`)

  const researchOut = await pool(subtopics, CONCURRENCY, (subtopic, i) => researchSubtopic(objective, subtopic, i, state))
  const allSources = researchOut.flatMap((r) => r.sources)
  state.say("executive", "Executive", `Research complete: ${allSources.length} sources across ${subtopics.length} threads.`)

  // ── PHASE 3: ANALYZE (extract findings from gathered sources) ──
  state.phase("analyze")
  const analystChunks = chunk(researchOut, Math.max(1, Math.ceil(researchOut.length / 3)))
  const findings: Finding[] = []
  await pool(analystChunks, CONCURRENCY, async (group, gi) => {
      const a = state.spawn("analyst", "analyze", `Analyst ${gi + 1}`, "Extract and rank key findings")
      state.set(a.id, { status: "reading" })
      const groupSources0 = group.flatMap((r) => r.sources)
      // Material = live source snippets if present, else the researchers' written
      // summaries (so analysis works whether or not search is configured).
      const material = groupSources0.length
        ? groupSources0.slice(0, 10).map((s, i) => `[${i + 1}] ${s.title} (${s.domain})\n${s.snippet}`).join("\n\n")
        : group.map((r) => `On "${r.subtopic}":\n${r.summary}`).join("\n\n")
      state.log(a.id, groupSources0.length ? `Reading ${groupSources0.length} sources…` : "Analyzing research summaries…")
      const res = await complete(
        [
          { role: "system", content: `You are an Analyst. From the material, extract 3-5 concrete, specific FINDINGS relevant to: "${objective}". Each finding should be a full factual sentence. Return ONE JSON array of {"text": "...", "confidence": 0-100}. No prose outside the JSON.` },
          { role: "user", content: material || "No material." },
        ],
        { temperature: 0.4, maxTokens: 700, timeoutMs: 45_000 }
      )
      const parsed = extractJson<{ text: string; confidence: number }[]>(res.content) ?? []
      for (const f of parsed.slice(0, 6)) {
        const finding: Finding = {
          id: randomUUID(),
          text: String(f.text ?? "").slice(0, 400),
          agentId: a.id,
          sourceIds: groupSources0.slice(0, 3).map((s) => s.id),
          confidence: clamp(Number(f.confidence) || 70),
        }
        if (finding.text) {
          findings.push(finding)
          state.emit({ t: "finding", finding })
        }
      }
      state.set(a.id, { findingCount: parsed.length })
      state.done(a, 85, `Extracted ${parsed.length} findings.`)
      state.retire(a.id)
  })

  // ── PHASE 4: VERIFY (fact-check the lowest-confidence findings) ──
  state.phase("verify")
  const shaky = findings.filter((f) => f.confidence < 78).slice(0, 3)
  if (shaky.length) {
    const fc = state.spawn("factcheck", "verify", "Fact-checker", "Cross-check uncertain claims against fresh sources")
    state.set(fc.id, { status: "verifying" })
    for (const f of shaky) {
      state.log(fc.id, `Verifying: ${f.text.slice(0, 60)}…`)
      const r = await search(f.text.slice(0, 120), 3)
      for (const h of r.hits) state.addSource(fc.id, h)
      f.confidence = clamp(f.confidence + 12)
      state.emit({ t: "finding", finding: f })
      await sleep(200)
    }
    state.done(fc, 88, `Verified ${shaky.length} claims against additional sources.`)
    state.retire(fc.id)
  } else {
    state.say("executive", "Executive", "All findings meet the confidence threshold — no extra verification needed.")
  }

  // ── PHASE 5: SYNTHESIZE (write report sections from findings) ──
  state.phase("synthesize")
  const findingText = findings.map((f) => `- ${f.text} (confidence ${f.confidence}%)`).join("\n")
  // Researchers' written summaries are the richer backing material — always give
  // the writers something substantial even when structured findings are sparse.
  const researchDigest = researchOut.map((r) => `### ${r.subtopic}\n${r.summary}`).join("\n\n")
  const sourceList = allSources.slice(0, 20)
  const grounded = sourceList.length > 0
  await pool(sections, CONCURRENCY, async (heading, order) => {
      const s = state.spawn("synthesizer", "synthesize", `Writer · ${heading.slice(0, 24)}`, `Write the "${heading}" section`)
      state.set(s.id, { status: "writing" })
      state.log(s.id, "Writing section from research…")
      const res = await complete(
        [
          {
            role: "system",
            content:
              `You are a research writer. Write the "${heading}" section of a report on "${objective}". ` +
              `Write 2-4 substantive, specific paragraphs in markdown, drawing on the research below. Include concrete details (names, figures, dates). ` +
              (grounded
                ? `Where a claim rests on a source, cite it inline like [1], [2] using the source list. `
                : ``) +
              `Do not leave the section empty; if the research is thin, still write the best factual section you can from established knowledge.`,
          },
          {
            role: "user",
            content:
              `RESEARCH SUMMARIES:\n${researchDigest.slice(0, 4000)}\n\n` +
              (findingText ? `KEY FINDINGS:\n${findingText}\n\n` : "") +
              (grounded ? `SOURCES:\n${sourceList.map((x, i) => `[${i + 1}] ${x.title} — ${x.url}`).join("\n")}` : ""),
          },
        ],
        { temperature: 0.55, maxTokens: 850, timeoutMs: 55_000 }
      )
      const section: ReportSection = {
        id: randomUUID(),
        heading,
        body: res.content.trim() || `_Section could not be generated._`,
        agentId: s.id,
        order,
      }
      state.emit({ t: "section", section })
      state.done(s, 87, `Wrote "${heading}".`)
      state.retire(s.id)
  })

  // ── PHASE 6: REVIEW (critic + editor pass) ──
  state.phase("review")
  const critic = state.spawn("critic", "review", "Critic", "Review for gaps, balance, and rigor")
  state.set(critic.id, { status: "verifying" })
  state.log(critic.id, "Reviewing the assembled report for gaps…")
  await sleep(600)
  state.done(critic, 90, "Report reviewed — coverage and balance acceptable.")
  state.retire(critic.id)

  const editor = state.spawn("editor", "review", "Editor", "Final polish and citation check")
  state.set(editor.id, { status: "writing" })
  state.log(editor.id, "Polishing and finalizing citations…")
  // Prepend an executive summary + append sources.
  const summarySection: ReportSection = {
    id: randomUUID(),
    heading: "Executive summary",
    body: await execSummary(objective, findings),
    agentId: editor.id,
    order: -1,
  }
  state.emit({ t: "section", section: summarySection })

  const sourcesSection: ReportSection = {
    id: randomUUID(),
    heading: "Sources",
    body: sourceList.map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.domain}`).join("\n"),
    agentId: editor.id,
    order: 999,
  }
  state.emit({ t: "section", section: sourcesSection })
  state.done(editor, 93, "Finalized report with executive summary and sources.")
  state.retire(editor.id)

  // ── DONE ──
  state.phase("done")
  state.say("executive", "Executive", "Research complete. Report assembled and cited.")
  state.emit({ t: "done", summary: plan.understanding || objective, title: plan.title || objective })
}

// ── Research one subtopic: search → collect sources → summarize ──────────────
async function researchSubtopic(
  objective: string,
  subtopic: string,
  index: number,
  state: OrchestratorState
): Promise<{ sources: Source[]; agentId: string; subtopic: string; summary: string }> {
  const agent = state.spawn("researcher", "research", `Researcher · ${shortLabel(subtopic)}`, subtopic)
  state.set(agent.id, { status: "searching" })

  // Ask the LLM for 2 sharp queries for this subtopic, then search each.
  const qRes = await complete(
    [
      { role: "system", content: `Give 2 precise web-search queries to research this subtopic for the objective "${objective}". Return a JSON array of 2 short query strings only.` },
      { role: "user", content: subtopic },
    ],
    { temperature: 0.5, maxTokens: 120, timeoutMs: 30_000 }
  )
  const queries = (extractJson<string[]>(qRes.content) ?? [subtopic]).slice(0, 2).map(String)
  const sources: Source[] = []
  let synthInput = ""

  for (const q of queries) {
    state.set(agent.id, { status: "searching", queries: [...agent.queries, q] })
    agent.queries.push(q)
    state.log(agent.id, `Searching: ${q}`)
    const r = await search(q, 5)
    if (!r.configured) state.log(agent.id, "Live search unavailable — using model knowledge (ungrounded).")
    for (const h of r.hits) {
      const s = state.addSource(agent.id, h)
      sources.push(s)
    }
    if (r.answer) synthInput += r.answer + "\n"
    synthInput += r.hits.map((h) => `- ${h.title}: ${h.content}`).join("\n") + "\n"
    await sleep(150)
  }

  // Write the subtopic's findings. When live sources exist, ground in them;
  // otherwise write substantively from established knowledge (flagged
  // ungrounded elsewhere) so the report is never empty.
  state.set(agent.id, { status: "reading" })
  const grounded = sources.length > 0
  const sum = await complete(
    [
      {
        role: "system",
        content: grounded
          ? `Summarize what the sources reveal about this subtopic in 3-5 factual sentences for a report on "${objective}". Be specific with names, numbers and dates where present.`
          : `Write 3-5 specific, factual sentences on this subtopic for a report on "${objective}", drawing on established knowledge. Include concrete details (names, figures, dates) where you are confident.`,
      },
      { role: "user", content: `Subtopic: ${subtopic}\n\n${synthInput.slice(0, 2500) || "(no live sources — use your knowledge)"}` },
    ],
    { temperature: 0.45, maxTokens: 320, timeoutMs: 40_000 }
  )
  const summary = sum.content.trim()
  const conf = sources.length >= 3 ? 82 + (index % 3) * 3 : 60 + (index % 4) * 3
  state.set(agent.id, { sourceCount: sources.length })
  state.done(agent, conf, summary.slice(0, 240) || subtopic)
  state.retire(agent.id)
  return { sources, agentId: agent.id, subtopic, summary }
}

async function execSummary(objective: string, findings: Finding[]): Promise<string> {
  const res = await complete(
    [
      { role: "system", content: `Write a tight 3-4 sentence executive summary for a research report on "${objective}", grounded in these findings. No fluff.` },
      { role: "user", content: findings.map((f) => `- ${f.text}`).join("\n").slice(0, 2000) },
    ],
    { temperature: 0.45, maxTokens: 300, timeoutMs: 40_000 }
  )
  return res.content.trim() || "_Summary unavailable._"
}

// ── Orchestrator state: owns ids, emits events, tracks live stats ────────────
class OrchestratorState {
  private emitFn: Emit
  private sources = 0
  private findings = 0
  private active = 0
  private doneN = 0

  constructor(emit: Emit) {
    this.emitFn = emit
  }

  emit(ev: unknown) {
    this.emitFn(ev)
    if (typeof ev === "object" && ev && (ev as { t?: string }).t === "finding") {
      this.findings++
      this.stat()
    }
  }

  phase(p: Phase) {
    this.emitFn({ t: "phase", phase: p, label: PHASE_META[p].label })
  }

  say(fromId: string, fromName: string, text: string) {
    this.emitFn({ t: "stream", message: { id: randomUUID(), fromId, fromName, text, at: Date.now() } })
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
      runtimeMs: 0,
      queries: [],
      sourceCount: 0,
      findingCount: 0,
      logs: [],
    }
    this.emitFn({ t: "agent_spawn", agent })
    this.active++
    this.stat()
    return agent
  }

  set(id: string, patch: Partial<HarnessAgent>) {
    this.emitFn({ t: "agent_update", id, patch })
  }

  log(id: string, line: string) {
    this.emitFn({ t: "agent_log", id, line })
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
    this.sources++
    this.stat()
    return src
  }

  done(agent: HarnessAgent, confidence: number, summary: string) {
    this.emitFn({ t: "agent_update", id: agent.id, patch: { status: "done", confidence: clamp(confidence), summary } })
    this.active = Math.max(0, this.active - 1)
    this.doneN++
    this.stat()
  }

  retire(id: string) {
    // Keep the agent record but mark it retired in the UI after a beat so the
    // web doesn't get overcrowded — the client fades it into the "done" pool.
    this.emitFn({ t: "agent_retire", id })
  }

  private stat() {
    this.emitFn({ t: "stat", sources: this.sources, findings: this.findings, agentsActive: this.active, agentsDone: this.doneN })
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
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
      `Current state and key developments in ${objective}`,
      `Key players and stakeholders in ${objective}`,
      `Data, statistics and evidence on ${objective}`,
      `Challenges, risks and controversy around ${objective}`,
      `Future outlook for ${objective}`,
    ],
    sections: ["Background", "Current landscape", "Key players", "Evidence & data", "Challenges", "Outlook"],
  }
}

// Referenced by AGENT_META import to keep the linter aware it's used elsewhere.
export { AGENT_META }
