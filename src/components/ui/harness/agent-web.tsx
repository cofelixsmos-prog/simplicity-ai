"use client"

import { useMemo } from "react"
import { AGENT_META, PHASE_META, type HarnessAgent, type Phase, type AgentStatus } from "@/lib/harness/types"

// Secondary "Agent web" view — the executive at center with specialist agents
// orbiting, grouped by phase ring. Glass nodes; click selects (opens the detail
// panel). Kept lightweight since the report is the primary surface.

const ACTIVE: AgentStatus[] = ["queued", "searching", "reading", "writing", "verifying"]

export function AgentWeb({
  agents,
  retired,
  selected,
  onSelect,
  phase,
  stats,
}: {
  agents: HarnessAgent[]
  retired: Set<string>
  selected: string | null
  onSelect: (id: string | null) => void
  phase: Phase
  stats: { sources: number; findings: number; agentsActive: number; agentsDone: number }
}) {
  // Group agents by phase; each phase forms a ring band.
  const layout = useMemo(() => {
    const n = agents.length || 1
    const radius = Math.min(40, 22 + n * 1.1)
    return agents.map((a, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      return { id: a.id, left: 50 + Math.cos(angle) * radius, top: 50 + Math.sin(angle) * radius }
    })
  }, [agents])
  const pos = (id: string) => layout.find((l) => l.id === id)

  const progress = agents.length ? Math.round((stats.agentsDone / (stats.agentsDone + stats.agentsActive || 1)) * 100) : 0

  return (
    <div className="relative h-full w-full" onClick={() => onSelect(null)}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {agents.map((a) => {
          const p = pos(a.id)
          if (!p) return null
          const active = ACTIVE.includes(a.status)
          return (
            <line
              key={a.id}
              x1="50%"
              y1="50%"
              x2={`${p.left}%`}
              y2={`${p.top}%`}
              stroke={active ? AGENT_META[a.kind].color : "rgba(255,255,255,0.08)"}
              strokeWidth={active ? 1.3 : 0.8}
              strokeDasharray={active ? "4 5" : undefined}
              className={active ? "harness-flow" : undefined}
              opacity={selected && selected !== a.id ? 0.2 : retired.has(a.id) ? 0.4 : 1}
            />
          )
        })}
      </svg>

      {/* executive */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="liquid-glass liquid-glass-soft glass-panel flex size-24 flex-col items-center justify-center rounded-full">
          <span className="text-[12.5px] font-semibold text-white">Executive</span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-white/50">
            <span className="size-1.5 rounded-full" style={{ background: PHASE_META[phase].color }} />
            {PHASE_META[phase].label}
          </span>
        </div>
        <svg className="pointer-events-none absolute -inset-1" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <circle cx="50" cy="50" r="48" fill="none" stroke="url(#hexecg)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 301.6} 301.6`} transform="rotate(-90 50 50)" />
          <defs>
            <linearGradient id="hexecg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* specialist nodes */}
      {agents.map((a) => {
        const p = pos(a.id)
        if (!p) return null
        const meta = AGENT_META[a.kind]
        const isSel = selected === a.id
        const dim = selected && !isSel
        const active = ACTIVE.includes(a.status)
        return (
          <div
            key={a.id}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300"
            style={{ left: `${p.left}%`, top: `${p.top}%`, opacity: dim ? 0.35 : retired.has(a.id) ? 0.6 : 1 }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(isSel ? null : a.id)
            }}
          >
            <button
              className={`liquid-glass liquid-glass-soft glass-panel flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 transition-transform hover:-translate-y-0.5 ${
                isSel ? "ring-2 ring-white/40" : ""
              }`}
            >
              <span className="relative flex size-2 items-center justify-center">
                <span className="size-2 rounded-full" style={{ background: meta.color }} />
                {active && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: meta.color }} />}
              </span>
              <span className="max-w-[130px] truncate text-[11px] font-medium text-white/90">{a.name}</span>
              {a.status === "done" && <span className="text-[10px] tabular-nums text-white/40">{a.confidence}%</span>}
            </button>
          </div>
        )
      })}

      {agents.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[13px] text-white/30">Assembling the team…</span>
        </div>
      )}
    </div>
  )
}
