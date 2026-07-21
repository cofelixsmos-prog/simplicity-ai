"use client"

import { AGENT_META, PHASE_META, type HarnessAgent, type Phase, type AgentStatus } from "@/lib/harness/types"
import { Loader2 } from "lucide-react"

// Left panel: the live roster of agents. Agents are dynamic — they appear when
// spawned and settle into a "done" pool as they finish. Grouped active-first.

const STATUS_LABEL: Record<AgentStatus, string> = {
  queued: "queued",
  searching: "searching",
  reading: "reading",
  writing: "writing",
  verifying: "verifying",
  done: "done",
  failed: "failed",
}

export function AgentsPanel({
  agents,
  retired,
  activeCount,
  selected,
  onSelect,
  phase,
}: {
  agents: HarnessAgent[]
  retired: Set<string>
  activeCount: number
  selected: string | null
  onSelect: (id: string) => void
  phase: Phase
}) {
  const active = agents.filter((a) => a.status !== "done" && a.status !== "failed")
  const doneAgents = agents.filter((a) => a.status === "done" || a.status === "failed")

  return (
    <aside className="liquid-glass liquid-glass-soft glass-panel hidden w-[248px] shrink-0 flex-col overflow-hidden rounded-2xl md:flex">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <span className="text-[12px] font-medium uppercase tracking-[0.15em] text-white/45">Agents</span>
        <span className="flex items-center gap-1.5 text-[11px] text-white/40">
          <span className="size-1.5 rounded-full" style={{ background: PHASE_META[phase].color }} />
          {agents.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {agents.length === 0 && (
          <p className="px-2 pt-3 text-[12px] text-white/30">The executive is assembling the team…</p>
        )}

        {active.length > 0 && (
          <>
            <GroupLabel text={`Active · ${activeCount}`} />
            <div className="space-y-1.5">
              {active.map((a) => (
                <AgentRow key={a.id} agent={a} selected={selected === a.id} onClick={() => onSelect(a.id)} />
              ))}
            </div>
          </>
        )}

        {doneAgents.length > 0 && (
          <>
            <GroupLabel text={`Completed · ${doneAgents.length}`} />
            <div className="space-y-1.5 opacity-70">
              {doneAgents.map((a) => (
                <AgentRow key={a.id} agent={a} selected={selected === a.id} onClick={() => onSelect(a.id)} muted retired={retired.has(a.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

function GroupLabel({ text }: { text: string }) {
  return <p className="px-2 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">{text}</p>
}

function AgentRow({ agent, selected, onClick, muted, retired }: { agent: HarnessAgent; selected: boolean; onClick: () => void; muted?: boolean; retired?: boolean }) {
  const meta = AGENT_META[agent.kind]
  const working = agent.status !== "done" && agent.status !== "failed"
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
        selected ? "border-white/25 bg-white/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
      }`}
    >
      <span className="relative flex size-2.5 shrink-0 items-center justify-center">
        <span className="size-2 rounded-full" style={{ background: meta.color }} />
        {working && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: meta.color }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-white/90">{agent.name}</span>
        <span className="block truncate text-[10.5px] text-white/40">
          {agent.status === "done"
            ? `${agent.confidence}% · ${agent.sourceCount || agent.findingCount || 0} ${agent.kind === "researcher" ? "sources" : "items"}`
            : STATUS_LABEL[agent.status]}
        </span>
      </span>
      {working && <Loader2 className="size-3 shrink-0 animate-spin text-white/30" />}
      {retired && <span className="size-1 shrink-0 rounded-full bg-white/20" />}
    </button>
  )
}
