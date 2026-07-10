"use client"

import { useState } from "react"
import { Loader2, Check, X, Maximize2 } from "lucide-react"
import type { Step } from "@/components/ui/tool-activity"

export interface AgentCard {
  id: string
  name: string
  task: string
  status: "running" | "done" | "error"
  steps: Step[]
  summary?: string
}

function StatusDot({ status }: { status: AgentCard["status"] }) {
  if (status === "running") return <span className="size-1.5 animate-pulse rounded-full bg-white/70" />
  if (status === "error") return <span className="size-1.5 rounded-full bg-red-400" />
  return <span className="size-1.5 rounded-full bg-emerald-400/90" />
}

// Fixed layout positions for up to 6 agents fanning out around the hub, mirroring
// the landing page's "It multiplies" swarm illustration (4-node case matches exactly).
const POSITIONS = [
  { x: -132, y: -78 },
  { x: 138, y: -64 },
  { x: -120, y: 84 },
  { x: 128, y: 92 },
  { x: 0, y: -118 },
  { x: 0, y: 118 },
]

// The live "swarm" visual: an orchestrator hub with each sub-agent as a node
// radiating outward. Hover or click a node to see its live steps/result inline;
// click the hub (or the header) to open the full control room via onOpen.
export function AgentSwarm({ agents, onOpen }: { agents: AgentCard[]; onOpen?: () => void }) {
  const [active, setActive] = useState<number | null>(null)
  if (agents.length === 0) return null

  const done = agents.filter((a) => a.status !== "running").length
  const activeAgent = active !== null ? agents[active] : null

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onOpen}
        className="group mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/40 transition-colors hover:text-white/70"
      >
        {agents.length} sub-agent{agents.length === 1 ? "" : "s"} · parallel
        <Maximize2 className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>

      <div className="relative mx-auto h-56 w-full max-w-md sm:h-64">
        <svg className="absolute inset-0 size-full" viewBox="-200 -140 400 280" aria-hidden>
          {agents.map((a, i) => {
            const pos = POSITIONS[i % POSITIONS.length]
            return (
              <line
                key={a.id}
                x1="0"
                y1="0"
                x2={pos.x}
                y2={pos.y}
                stroke={active === i ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)"}
                strokeDasharray="3 5"
                className="transition-[stroke] duration-200"
              />
            )
          })}
        </svg>

        {/* orchestrator hub */}
        <button
          type="button"
          onClick={onOpen}
          className="absolute left-1/2 top-1/2 z-10 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/20 bg-[#15171d] shadow-2xl transition-colors hover:border-white/35"
          aria-label="Open sub-agent control room"
        >
          <span className="text-lg font-bold text-white">S</span>
        </button>

        {/* agent nodes */}
        {agents.map((a, i) => {
          const pos = POSITIONS[i % POSITIONS.length]
          return (
            <button
              type="button"
              key={a.id}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
              onFocus={() => setActive(i)}
              onClick={() => setActive((cur) => (cur === i ? null : i))}
              style={{ left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)` }}
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-500 ease-out ${
                active === i ? "z-20" : ""
              }`}
            >
              <span
                className={`flex items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3.5 shadow-xl transition-colors ${
                  active === i ? "border-white/35 bg-[#181a20]" : "border-white/12 bg-[#101217]"
                }`}
              >
                <StatusDot status={a.status} />
                <span className="whitespace-nowrap text-[11px] font-medium text-white/80">{a.name}</span>
              </span>

              {active === i && (
                <div className="absolute left-1/2 top-full z-30 mt-2 w-60 -translate-x-1/2 rounded-xl border border-white/12 bg-[#101217] p-3 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {a.status === "running" ? (
                      <Loader2 className="size-3 shrink-0 animate-spin text-white/45" />
                    ) : a.status === "error" ? (
                      <X className="size-3 shrink-0 text-red-400" />
                    ) : (
                      <Check className="size-3 shrink-0 text-emerald-400/80" />
                    )}
                    <span className="truncate text-[12px] font-semibold text-white/85">{a.name}</span>
                  </div>
                  <p className="line-clamp-2 text-[11.5px] text-white/45">{a.task}</p>

                  {a.steps.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
                      {a.steps.map((s) => (
                        <div key={s.id} className="flex items-center gap-1.5 text-[11px] text-white/55">
                          {s.status === "running" ? (
                            <Loader2 className="size-3 shrink-0 animate-spin text-white/40" />
                          ) : s.status === "error" ? (
                            <X className="size-3 shrink-0 text-red-400" />
                          ) : (
                            <Check className="size-3 shrink-0 text-emerald-400/80" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {a.summary && a.status === "done" && (
                    <p className="mt-2 line-clamp-3 border-t border-white/5 pt-2 text-[11px] text-white/40">
                      {a.summary}
                    </p>
                  )}
                </div>
              )}
            </button>
          )
        })}

        {/* progress bar */}
        <div className="absolute inset-x-8 -bottom-2 sm:-bottom-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
            <span>{agents.length} agents · parallel</span>
            <span className="tabular-nums">{done}/{agents.length} done</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-white/40 transition-[width] duration-500"
              style={{ width: `${(done / agents.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
