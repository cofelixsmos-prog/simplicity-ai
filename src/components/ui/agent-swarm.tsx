"use client"

import { Loader2, Check, X, Bot } from "lucide-react"
import type { Step } from "@/components/ui/tool-activity"

export interface AgentCard {
  id: string
  name: string
  task: string
  status: "running" | "done" | "error"
  steps: Step[]
  summary?: string
}

function StatusIcon({ status, size = 3.5 }: { status: AgentCard["status"]; size?: number }) {
  const cls = `size-${size === 3 ? "3" : "3.5"} shrink-0`
  if (status === "running") return <Loader2 className={`${cls} animate-spin text-white/45`} />
  if (status === "error") return <X className={`${cls} text-red-400`} />
  return <Check className={`${cls} text-emerald-400/80`} />
}

// The live "swarm" panel: one card per sub-agent, each showing its task,
// status, the tools it used, and a short result summary when done.
export function AgentSwarm({ agents }: { agents: AgentCard[] }) {
  if (agents.length === 0) return null
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/40">
        <Bot className="size-3.5" />
        {agents.length} sub-agent{agents.length === 1 ? "" : "s"}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {agents.map((a) => (
          <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">{a.name}</span>
              <StatusIcon status={a.status} />
            </div>
            <p className="mt-0.5 line-clamp-2 text-[12px] text-white/45">{a.task}</p>

            {a.steps.length > 0 && (
              <div className="mt-2 space-y-1">
                {a.steps.map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 text-[11.5px] text-white/55">
                    <StatusIcon status={s.status} size={3} />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {a.summary && a.status === "done" && (
              <p className="mt-2 line-clamp-3 border-t border-white/5 pt-2 text-[11.5px] text-white/40">
                {a.summary}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
