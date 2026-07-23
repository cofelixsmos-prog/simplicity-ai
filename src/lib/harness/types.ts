// Shared Harness types. Harness is a cinematic deep-research system: it clarifies
// the objective full-screen, then runs a living web of specialist agents that
// search, collaborate, get gated on quality by the executive, hold a peer-review
// conference near completion, and reveal a cited report.

export type AgentKind =
  | "planner"
  | "researcher"
  | "analyst"
  | "factcheck"
  | "synthesizer"
  | "critic"
  | "editor"

export type AgentStatus =
  | "queued"
  | "searching"
  | "reading"
  | "writing"
  | "verifying"
  | "held" // paused by the executive for low quality
  | "done"
  | "failed"

export type Phase = "clarify" | "plan" | "research" | "analyze" | "verify" | "synthesize" | "conference" | "review" | "done"

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
  agentName: string
  sourceIds: string[]
  confidence: number // = data quality (0–100)
  votes: number // peer votes from the conference
  featured?: boolean
  cut?: boolean
}

export interface HarnessAgent {
  id: string
  kind: AgentKind
  name: string
  task: string
  phase: Phase
  status: AgentStatus
  confidence: number // quality of this agent's data (0–100)
  progress: number // 0–100 through this agent's own steps
  runtimeMs: number
  queries: string[]
  sourceCount: number
  findingCount: number
  logs: string[]
  summary?: string
}

export interface ReportSection {
  id: string
  heading: string
  body: string
  agentId: string
  order: number
}

// A message between agents, shown as a pulse traveling the connecting line.
export interface Collab {
  id: string
  fromId: string
  toId: string // "executive" or an agent id
  fromName: string
  text: string
  at: number
}

export interface Question {
  id: string
  text: string
  options: string[] // suggested answers; user may also type freely
}

// ── Stream events (one JSON object per NDJSON line) ──────────────────────────
export type HarnessEvent =
  | { t: "run"; runId: string }
  | { t: "steer_ack"; text: string } // executive acknowledged a live steer
  | { t: "agent_retire"; id: string } // an agent was cut (off-track / low value)
  | { t: "clarify"; questions: Question[]; intro: string }
  | { t: "objective"; text: string; summary: string; title: string }
  | { t: "phase"; phase: Phase; label: string }
  | { t: "agent_spawn"; agent: HarnessAgent }
  | { t: "agent_update"; id: string; patch: Partial<HarnessAgent> }
  | { t: "agent_log"; id: string; line: string }
  | { t: "collab"; collab: Collab }
  | { t: "caption"; text: string } // the single quiet line narrating the run
  | { t: "hold"; id: string; reason: string } // executive paused an agent
  | { t: "resume"; id: string } // agent's quality recovered
  | { t: "source"; source: Source }
  | { t: "finding"; finding: Finding }
  | { t: "conference"; entries: { agentId: string; agentName: string; findingId: string; text: string }[] }
  | { t: "vote"; findingId: string; votes: number; featured: boolean; cut: boolean }
  | { t: "section"; section: ReportSection }
  | { t: "ask"; question: Question } // mid-run clarification
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
  clarify: { label: "Clarifying", color: "#A78BFA" },
  plan: { label: "Planning", color: "#A78BFA" },
  research: { label: "Researching", color: "#38BDF8" },
  analyze: { label: "Analyzing", color: "#22D3EE" },
  verify: { label: "Verifying", color: "#F87171" },
  synthesize: { label: "Synthesizing", color: "#34D399" },
  conference: { label: "Peer review", color: "#FBBF24" },
  review: { label: "Finalizing", color: "#FBBF24" },
  done: { label: "Complete", color: "#34D399" },
}
