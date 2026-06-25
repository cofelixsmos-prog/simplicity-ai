"use client"

import { Loader2, Check, Search, Clock, Wrench, X } from "lucide-react"
import type { ComponentType } from "react"

export interface Step {
  id: string
  tool: string
  label: string
  status: "running" | "done" | "error"
  detail?: string
}

// Per-tool icon; falls back to a generic wrench for unknown tools.
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  web_search: Search,
  get_datetime: Clock,
}

// The live "agent is doing things" panel shown above an assistant message.
export function ToolActivity({ steps }: { steps: Step[] }) {
  if (steps.length === 0) return null
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {steps.map((s) => {
        const Icon = ICONS[s.tool] ?? Wrench
        return (
          <div
            key={s.id}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70"
          >
            <Icon className="size-3.5 shrink-0 text-white/45" />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            {s.status === "running" ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-white/45" />
            ) : s.status === "error" ? (
              <X className="size-3.5 shrink-0 text-red-400" />
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 text-white/40">
                {s.detail && <span className="text-[11px]">{s.detail}</span>}
                <Check className="size-3.5 text-emerald-400/80" />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
