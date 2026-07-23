"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AGENT_META, type HarnessAgent, type Collab, type Phase, type AgentStatus } from "@/lib/harness/types"

// The living execution stage. The executive sits at center; specialist agents
// orbit and gently drift. When agents collaborate, a pulse travels the line
// between them carrying a short message. Held (low-quality) agents dim with a
// warning ring. During the conference, everything converges inward.
//
// Motion is done on a canvas-less SVG with a rAF loop nudging each node around
// its anchor, so it feels alive rather than a static diagram.

interface Node {
  id: string
  ax: number // anchor (0-1 of viewport)
  ay: number
  x: number // live position
  y: number
  vx: number
  vy: number
  phase: number // drift phase
}

const ACTIVE: AgentStatus[] = ["queued", "searching", "reading", "writing", "verifying"]

interface Pulse {
  id: string
  fromId: string
  toId: string
  text: string
  start: number
}

export function AgentStage({
  agents,
  collabs,
  phase,
  caption,
  selected,
  onSelect,
}: {
  selected?: string | null
  onSelect?: (id: string | null) => void
  agents: HarnessAgent[]
  collabs: Collab[]
  phase: Phase
  caption: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)
  const nodesRef = useRef<Map<string, Node>>(new Map())
  const conferencing = phase === "conference"
  const selectedAgent = agents.find((a) => a.id === selected) ?? null

  // Ensure a node exists for each agent; anchor on a ring.
  useMemo(() => {
    const m = nodesRef.current
    const n = agents.length || 1
    agents.forEach((a, i) => {
      if (!m.has(a.id)) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        const r = 0.32
        const ax = 0.5 + Math.cos(angle) * r
        const ay = 0.5 + Math.sin(angle) * r
        m.set(a.id, { id: a.id, ax, ay, x: 0.5, y: 0.5, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2 })
      }
    })
    // re-anchor all nodes evenly as the count changes
    const ids = agents.map((a) => a.id)
    ids.forEach((id, i) => {
      const node = m.get(id)
      if (!node) return
      const angle = (i / ids.length) * Math.PI * 2 - Math.PI / 2
      const r = 0.32
      node.ax = 0.5 + Math.cos(angle) * r
      node.ay = 0.5 + Math.sin(angle) * r
    })
  }, [agents])

  // Animation loop: drift toward anchor (or center during conference) with a
  // little organic wobble.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const t = performance.now() / 1000
      nodesRef.current.forEach((nd) => {
        const targetX = conferencing ? 0.5 + Math.cos(nd.phase + t * 0.4) * 0.12 : nd.ax + Math.sin(t * 0.5 + nd.phase) * 0.012
        const targetY = conferencing ? 0.5 + Math.sin(nd.phase + t * 0.4) * 0.12 : nd.ay + Math.cos(t * 0.4 + nd.phase) * 0.012
        nd.vx += (targetX - nd.x) * 0.02
        nd.vy += (targetY - nd.y) * 0.02
        nd.vx *= 0.86
        nd.vy *= 0.86
        nd.x += nd.vx
        nd.y += nd.vy
      })
      force((v) => (v + 1) % 1000000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [conferencing])

  // Turn incoming collabs into transient pulses along the lines.
  const [pulses, setPulses] = useState<Pulse[]>([])
  const seen = useRef<Set<string>>(new Set())
  useEffect(() => {
    const fresh = collabs.filter((c) => !seen.current.has(c.id)).slice(-6)
    if (!fresh.length) return
    fresh.forEach((c) => seen.current.add(c.id))
    setPulses((prev) => [
      ...prev,
      ...fresh.map((c) => ({ id: c.id, fromId: c.fromId, toId: c.toId, text: c.text, start: performance.now() })),
    ])
    const t = setTimeout(() => {
      setPulses((prev) => prev.filter((p) => performance.now() - p.start < 2600))
    }, 2700)
    return () => clearTimeout(t)
  }, [collabs])

  const W = wrapRef.current?.clientWidth ?? 1000
  const H = wrapRef.current?.clientHeight ?? 640
  const px = (v: number) => v * W
  const py = (v: number) => v * H
  const center = { x: 0.5, y: 0.5 }
  const nodePos = (id: string) => {
    if (id === "executive") return center
    const nd = nodesRef.current.get(id)
    return nd ? { x: nd.x, y: nd.y } : center
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden" onClick={() => onSelect?.(null)}>
      <svg className="absolute inset-0 h-full w-full">
        {/* executive → agent tethers */}
        {agents.map((a) => {
          const p = nodePos(a.id)
          const active = ACTIVE.includes(a.status)
          const held = a.status === "held"
          return (
            <line
              key={`t-${a.id}`}
              x1={px(0.5)}
              y1={py(0.5)}
              x2={px(p.x)}
              y2={py(p.y)}
              stroke={held ? "rgba(251,191,36,0.35)" : active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)"}
              strokeWidth={active ? 1.2 : 0.8}
            />
          )
        })}

        {/* collaboration pulses traveling the lines */}
        {pulses.map((pl) => {
          const from = nodePos(pl.fromId)
          const to = nodePos(pl.toId)
          const elapsed = (performance.now() - pl.start) / 1600
          const tt = Math.min(1, elapsed)
          const cx = from.x + (to.x - from.x) * tt
          const cy = from.y + (to.y - from.y) * tt
          if (tt >= 1) return null
          return (
            <g key={pl.id}>
              <line x1={px(from.x)} y1={py(from.y)} x2={px(to.x)} y2={py(to.y)} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
              <circle cx={px(cx)} cy={py(cy)} r="3.5" fill="#fff">
                <animate attributeName="opacity" from="1" to="0.4" dur="1.6s" />
              </circle>
            </g>
          )
        })}

        {/* executive core — solid ring, no gradient */}
        <g>
          <circle cx={px(0.5)} cy={py(0.5)} r="46" fill="#0c0c12" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
          <circle cx={px(0.5)} cy={py(0.5)} r="46" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
            <animate attributeName="stroke-dasharray" values="4 289;289 4;4 289" dur="6s" repeatCount="indefinite" />
          </circle>
          <text x={px(0.5)} y={py(0.5) - 2} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff">
            Executive
          </text>
          <text x={px(0.5)} y={py(0.5) + 14} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.45)">
            {conferencing ? "conference" : phase}
          </text>
        </g>

        {/* agent nodes */}
        {agents.map((a) => {
          const p = nodePos(a.id)
          const meta = AGENT_META[a.kind]
          const active = ACTIVE.includes(a.status)
          const held = a.status === "held"
          const done = a.status === "done"
          const isSel = selected === a.id
          return (
            <g
              key={a.id}
              opacity={held ? 0.5 : selected && !isSel ? 0.4 : 1}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(isSel ? null : a.id)
              }}
            >
              {isSel && <circle cx={px(p.x)} cy={py(p.y)} r="30" fill={meta.color} opacity="0.12" />}
              {/* quality ring */}
              <circle cx={px(p.x)} cy={py(p.y)} r="22" fill="#0e0e14" stroke={held ? "#FBBF24" : done ? "#34D399" : meta.color} strokeWidth={isSel ? 2.5 : held ? 2 : 1.5} strokeDasharray={held ? "3 3" : undefined} />
              <circle
                cx={px(p.x)}
                cy={py(p.y)}
                r="22"
                fill="none"
                stroke={meta.color}
                strokeWidth="2.5"
                strokeDasharray={`${(a.confidence / 100) * 138} 138`}
                transform={`rotate(-90 ${px(p.x)} ${py(p.y)})`}
                opacity="0.9"
              />
              {active && (
                <circle cx={px(p.x)} cy={py(p.y)} r="22" fill="none" stroke={meta.color} strokeWidth="1" opacity="0.4">
                  <animate attributeName="r" values="22;30;22" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
              <text x={px(p.x)} y={py(p.y) - 1} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#fff">
                {meta.label}
              </text>
              <text x={px(p.x)} y={py(p.y) + 9} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.5)">
                {held ? "held" : done ? `${a.confidence}%` : a.status}
              </text>
            </g>
          )
        })}
      </svg>

      {/* the single quiet caption */}
      {caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-6">
          <span className="max-w-[80%] text-center text-[13px] text-white/50 transition-opacity duration-500">{caption}</span>
        </div>
      )}

      {/* latest collab lines as faint floating text near nodes (max 2) */}
      {pulses.slice(-2).map((pl) => {
        const to = nodePos(pl.toId)
        return (
          <span
            key={`lbl-${pl.id}`}
            className="pointer-events-none absolute max-w-[220px] -translate-x-1/2 truncate text-[10.5px] text-white/40"
            style={{ left: `${to.x * 100}%`, top: `calc(${to.y * 100}% + 30px)` }}
          >
            {pl.text}
          </span>
        )
      })}

      {conferencing && (
        <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-[12px] text-amber-200">
            Peer-review conference — voting on the strongest findings
          </span>
        </div>
      )}

      {/* per-agent progress list (top-left) — click a row to inspect */}
      {agents.length > 0 && !selected && (
        <div className="absolute left-4 top-4 max-h-[70%] w-60 overflow-y-auto">
          <div className="space-y-1.5">
            {agents.map((a) => {
              const meta = AGENT_META[a.kind]
              return (
                <button
                  key={a.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect?.(a.id)
                  }}
                  className="block w-full rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-1.5 text-left backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-white/80">{a.name}</span>
                    <span className="text-[10px] tabular-nums text-white/40">{a.progress}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${a.progress}%`, background: a.status === "held" ? "#FBBF24" : meta.color }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* rich, clean detail when an agent is selected (right) */}
      {selectedAgent && (
        <div className="absolute right-4 top-4 bottom-4 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
          <AgentDetail agent={selectedAgent} onClose={() => onSelect?.(null)} />
        </div>
      )}
    </div>
  )
}

// Rich but clean per-agent detail — everything about the agent, no clutter.
function AgentDetail({ agent, onClose }: { agent: HarnessAgent; onClose: () => void }) {
  const meta = AGENT_META[agent.kind]
  const working = agent.status !== "done" && agent.status !== "failed"
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{agent.name}</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/55">
        {meta.label}
        <span className="text-white/25">·</span>
        <span className={working ? "text-sky-300" : "text-emerald-300"}>{agent.status}</span>
      </span>

      <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{agent.task}</p>

      <Bar label="Progress" value={agent.progress} color="#38BDF8" />
      <Bar label="Confidence (data quality)" value={agent.confidence} color={meta.color} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <Stat label="Runtime" value={`${(agent.runtimeMs / 1000).toFixed(0)}s`} />
        <Stat label="Sources" value={String(agent.sourceCount)} />
      </div>

      {agent.queries.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/35">Searches</p>
          {agent.queries.map((q, i) => (
            <p key={i} className="truncate text-[11.5px] text-white/60">🔍 {q}</p>
          ))}
        </div>
      )}

      {agent.summary && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/35">Result</p>
          <p className="text-[11.5px] leading-relaxed text-white/55">{agent.summary}</p>
        </div>
      )}

      {agent.logs.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/35">Activity</p>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/40 p-2 font-mono text-[10.5px] leading-relaxed text-white/50">
            {agent.logs.slice(-8).map((l, i) => (
              <div key={i} className="truncate">› {l}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[10.5px]">
        <span className="uppercase tracking-wide text-white/35">{label}</span>
        <span className="tabular-nums text-white/70">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5">
      <div className="text-[12.5px] font-semibold text-white">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-white/35">{label}</div>
    </div>
  )
}
