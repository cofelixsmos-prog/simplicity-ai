"use client"

import { Loader2, Check, X, Bot, Search, Clock, Wrench } from "lucide-react"
import type { ComponentType } from "react"
import type { AgentCard } from "@/components/ui/agent-swarm"
import type { Step } from "@/components/ui/tool-activity"

const STEP_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  web_search: Search,
  get_datetime: Clock,
}

function StepRow({ s }: { s: Step }) {
  const Icon = STEP_ICONS[s.tool] ?? Wrench
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-white/60">
      <Icon className="size-3.5 shrink-0 text-white/40" />
      <span className="min-w-0 flex-1 truncate">{s.label}</span>
      {s.status === "running" ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-white/40" />
      ) : s.status === "error" ? (
        <X className="size-3.5 shrink-0 text-red-400" />
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 text-white/35">
          {s.detail && <span className="text-[10.5px]">{s.detail}</span>}
          <Check className="size-3.5 text-emerald-400/80" />
        </span>
      )}
    </div>
  )
}

// The expanded "control room": every sub-agent, its full task, every tool
// step it ran, and its complete result — updating live as the swarm works.
export function AgentPanel({ agents, onClose }: { agents: AgentCard[]; onClose: () => void }) {
  const running = agents.filter((a) => a.status === "running").length

  return (
    <aside className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">Sub-agents</span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {running > 0 ? `${running} working` : `${agents.length} done`}
          </span>
        </div>
        <button
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Close panel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {agents.map((a, i) => (
          <div
            key={a.id}
            style={{ animationDelay: `${i * 70}ms` }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{a.name}</span>
              {a.status === "running" ? (
                <span className="flex items-center gap-1.5 text-[11px] text-white/50">
                  <Loader2 className="size-3.5 animate-spin" /> working
                </span>
              ) : a.status === "error" ? (
                <X className="size-4 text-red-400" />
              ) : (
                <Check className="size-4 text-emerald-400/80" />
              )}
            </div>

            <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/50">{a.task}</p>

            {a.steps.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                {a.steps.map((s) => (
                  <StepRow key={s.id} s={s} />
                ))}
              </div>
            )}

            {a.summary && a.status !== "running" && (
              <p className="mt-3 whitespace-pre-wrap border-t border-white/5 pt-3 text-[12.5px] leading-relaxed text-white/55">
                {a.summary}
              </p>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
