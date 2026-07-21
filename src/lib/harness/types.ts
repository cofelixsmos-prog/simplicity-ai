// Shared Harness types — used by the deep-research orchestrator (streamed as
// NDJSON) and the workspace UI. Harness is a Claude-style deep-research system:
// an executive decomposes an objective into ~20 dynamic specialist agents that
// search the live web, extract findings, cross-check, and synthesize a cited
// report.

export type AgentKind =
  | "planner"
  | "researcher" // runs web searches on a subtopic
  | "analyst" // extracts findings from sources
  | "factcheck" // verifies claims across sources
  | "synthesizer" // writes report sections
  | "critic" // reviews quality / gaps
  | "editor" // final polish

export type AgentStatus = "queued" | "searching" | "reading" | "writing" | "verifying" | "done" | "failed"

// The research proceeds in phases; agents belong to a phase.
export type Phase = "plan" | "research" | "analyze" | "verify" | "synthesize" | "review" | "done"

export interface Source {
  id: string
  title: string
  url: string
  snippet: string
  agentId: string
  domain: string
}

export interface Finding {
  id: string
  text: string
  agentId: string
  sourceIds: string[]
  confidence: number // 0–100
}

export interface HarnessAgent {
  id: string
  kind: AgentKind
  name: string
  task: string
  phase: Phase
  status: AgentStatus
  confidence: number
  runtimeMs: number
  queries: string[] // searches this agent ran
  sourceCount: number
  findingCount: number
  logs: string[]
  summary?: string
}

export interface ReportSection {
  id: string
  heading: string
  body: string // markdown
  agentId: string
  order: number
}

export interface StreamMessage {
  id: string
  fromId: string
  fromName: string
  text: string
  at: number
}

// ── Stream events (one JSON object per NDJSON line) ──────────────────────────
export type HarnessEvent =
  | { t: "objective"; text: string; summary: string; etaMs: number; plannedAgents: number }
  | { t: "phase"; phase: Phase; label: string }
  | { t: "agent_spawn"; agent: HarnessAgent }
  | { t: "agent_update"; id: string; patch: Partial<HarnessAgent> }
  | { t: "agent_log"; id: string; line: string }
  | { t: "agent_retire"; id: string } // agent finished and cleared
  | { t: "source"; source: Source }
  | { t: "finding"; finding: Finding }
  | { t: "section"; section: ReportSection }
  | { t: "section_update"; id: string; body: string }
  | { t: "stream"; message: StreamMessage }
  | { t: "stat"; sources: number; findings: number; agentsActive: number; agentsDone: number }
  | { t: "done"; summary: string; title: string }
  | { t: "error"; message: string }

export const AGENT_META: Record<AgentKind, { label: string; color: string }> = {
  planner: { label: "Planner", color: "#A78BFA" },
  researcher: { label: "Researcher", color: "#38BDF8" },
  analyst: { label: "Analyst", color: "#22D3EE" },
  factcheck: { label: "Fact-check", color: "#F87171" },
  synthesizer: { label: "Synthesizer", color: "#34D399" },
  critic: { label: "Critic", color: "#FBBF24" },
  editor: { label: "Editor", color: "#C084FC" },
}

export const PHASE_META: Record<Phase, { label: string; color: string }> = {
  plan: { label: "Planning", color: "#A78BFA" },
  research: { label: "Research", color: "#38BDF8" },
  analyze: { label: "Analysis", color: "#22D3EE" },
  verify: { label: "Verification", color: "#F87171" },
  synthesize: { label: "Synthesis", color: "#34D399" },
  review: { label: "Review", color: "#FBBF24" },
  done: { label: "Complete", color: "#34D399" },
}
