"use client"

import { X, ExternalLink, Search } from "lucide-react"
import { AGENT_META, type Finding, type HarnessAgent, type Source } from "@/lib/harness/types"

// Right panel. Shows the selected agent's live detail (task, confidence,
// queries, its sources, logs). With nothing selected, shows the global source
// library so the panel is always useful.
export function AgentDetail({
  agent,
  sources,
  findings,
  onClose,
}: {
  agent: HarnessAgent | null
  sources: Source[]
  findings: Finding[]
  onClose: () => void
}) {
  if (!agent) {
    return (
      <aside className="liquid-glass liquid-glass-soft glass-panel hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl lg:flex">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4">
          <span className="text-[12px] font-medium uppercase tracking-[0.15em] text-white/45">Sources</span>
          <span className="ml-auto text-[11px] text-white/35">{sources.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {sources.length === 0 ? (
            <p className="px-1 pt-2 text-[12px] text-white/30">Sources gathered by researchers appear here.</p>
          ) : (
            <div className="space-y-2">
              {sources.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
            </div>
          )}
        </div>
      </aside>
    )
  }

  const meta = AGENT_META[agent.kind]
  const agentSources = sources.filter((s) => s.agentId === agent.id)
  const agentFindings = findings.filter((f) => f.agentId === agent.id)
  const working = agent.status !== "done" && agent.status !== "failed"

  return (
    <aside className="liquid-glass liquid-glass-soft glass-panel hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl lg:flex">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4">
        <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
        <span className="truncate text-[13px] font-medium text-white">{agent.name}</span>
        <button onClick={onClose} className="ml-auto flex size-6 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white">
          <X className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/55">
          {meta.label}
          <span className="text-white/30">·</span>
          <span className={working ? "text-sky-300" : "text-emerald-300"}>{agent.status}</span>
        </span>

        <p className="mt-3 text-[13px] leading-relaxed text-white/75">{agent.task}</p>

        {/* live confidence bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-white/35">Confidence</span>
            <span className="tabular-nums text-white/70">{agent.confidence}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${agent.confidence}%`, background: meta.color }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Runtime" value={`${(agent.runtimeMs / 1000).toFixed(0)}s`} />
          <Mini label="Sources" value={String(agent.sourceCount || agentSources.length)} />
          <Mini label="Findings" value={String(agent.findingCount || agentFindings.length)} />
        </div>

        {agent.queries.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/35">Searches</p>
            <div className="space-y-1">
              {agent.queries.map((q, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[12px] text-white/60">
                  <Search className="mt-0.5 size-3 shrink-0 text-white/30" />
                  <span className="leading-snug">{q}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {agent.summary && (
          <div className="mt-4">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/35">Result</p>
            <p className="text-[12.5px] leading-relaxed text-white/60">{agent.summary}</p>
          </div>
        )}

        {agentSources.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/35">Sources found</p>
            <div className="space-y-2">
              {agentSources.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
            </div>
          </div>
        )}

        {agent.logs.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/35">Activity</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed text-white/50">
              {agent.logs.map((l, i) => (
                <div key={i} className="truncate">
                  <span className="text-white/25">›</span> {l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
    >
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[11px] text-white/40">{source.domain}</span>
        <ExternalLink className="size-2.5 shrink-0 text-white/30" />
      </div>
      <p className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-white/85">{source.title}</p>
      {source.snippet && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/45">{source.snippet}</p>}
    </a>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2">
      <div className="text-[13px] font-semibold text-white">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-white/35">{label}</div>
    </div>
  )
}
