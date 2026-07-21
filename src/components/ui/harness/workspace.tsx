"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUp, Share2, Square, FileText, Network } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import {
  AGENT_META,
  PHASE_META,
  type Finding,
  type HarnessAgent,
  type Phase,
  type ReportSection,
  type Source,
  type StreamMessage,
} from "@/lib/harness/types"
import { AgentsPanel } from "@/components/ui/harness/agents-panel"
import { AgentDetail } from "@/components/ui/harness/agent-detail"
import { ReportView } from "@/components/ui/harness/report-view"
import { AgentWeb } from "@/components/ui/harness/agent-web"

type RunState = "idle" | "running" | "done"
type CenterTab = "report" | "web"

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

interface Stats {
  sources: number
  findings: number
  agentsActive: number
  agentsDone: number
}

export function HarnessWorkspace({ userName }: { userName: string | null }) {
  const [run, setRun] = useState<RunState>("idle")
  const [objective, setObjective] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [input, setInput] = useState("")

  const [phase, setPhase] = useState<Phase>("plan")
  const [agents, setAgents] = useState<HarnessAgent[]>([])
  const [retired, setRetired] = useState<Set<string>>(new Set())
  const [sources, setSources] = useState<Source[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [sections, setSections] = useState<ReportSection[]>([])
  const [stream, setStream] = useState<StreamMessage[]>([])
  const [stats, setStats] = useState<Stats>({ sources: 0, findings: 0, agentsActive: 0, agentsDone: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<CenterTab>("report")

  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (run !== "running") return
    startRef.current = Date.now()
    const t = setInterval(() => {
      setElapsed(Date.now() - startRef.current)
      setAgents((prev) => prev.map((a) => (a.status !== "done" && a.status !== "failed" ? { ...a, runtimeMs: a.runtimeMs + 400 } : a)))
    }, 400)
    return () => clearInterval(t)
  }, [run])

  const onEvent = useCallback((line: string) => {
    let ev: Record<string, unknown>
    try {
      ev = JSON.parse(line)
    } catch {
      return
    }
    switch (ev.t) {
      case "objective":
        setSummary(String(ev.summary ?? ""))
        break
      case "phase":
        setPhase(ev.phase as Phase)
        break
      case "agent_spawn":
        setAgents((p) => [...p, ev.agent as HarnessAgent])
        break
      case "agent_update":
        setAgents((p) => p.map((a) => (a.id === ev.id ? { ...a, ...(ev.patch as Partial<HarnessAgent>) } : a)))
        break
      case "agent_log":
        setAgents((p) => p.map((a) => (a.id === ev.id ? { ...a, logs: [...a.logs, String(ev.line)] } : a)))
        break
      case "agent_retire":
        setRetired((p) => new Set(p).add(String(ev.id)))
        break
      case "source":
        setSources((p) => [...p, ev.source as Source])
        break
      case "finding":
        setFindings((p) => {
          const f = ev.finding as Finding
          const i = p.findIndex((x) => x.id === f.id)
          if (i >= 0) {
            const copy = [...p]
            copy[i] = f
            return copy
          }
          return [...p, f]
        })
        break
      case "section":
        setSections((p) => {
          const s = ev.section as ReportSection
          const i = p.findIndex((x) => x.id === s.id)
          if (i >= 0) {
            const copy = [...p]
            copy[i] = s
            return copy
          }
          return [...p, s].sort((a, b) => a.order - b.order)
        })
        break
      case "section_update":
        setSections((p) => p.map((s) => (s.id === ev.id ? { ...s, body: String(ev.body) } : s)))
        break
      case "stream":
        setStream((p) => [...p.slice(-60), ev.message as StreamMessage])
        break
      case "stat":
        setStats({ sources: Number(ev.sources), findings: Number(ev.findings), agentsActive: Number(ev.agentsActive), agentsDone: Number(ev.agentsDone) })
        break
      case "done":
        setSummary(String(ev.summary ?? ""))
        setTitle(String(ev.title ?? ""))
        setRun("done")
        break
      case "error":
        setRun("done")
        break
    }
  }, [])

  const launch = useCallback(
    async (obj: string) => {
      const o = obj.trim()
      if (!o || run === "running") return
      // New objective → agents gone, everything cleared.
      setRun("running")
      setObjective(o)
      setTitle("")
      setSummary("")
      setPhase("plan")
      setAgents([])
      setRetired(new Set())
      setSources([])
      setFindings([])
      setSections([])
      setStream([])
      setStats({ sources: 0, findings: 0, agentsActive: 0, agentsDone: 0 })
      setSelected(null)
      setTab("report")
      setElapsed(0)

      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch("/api/harness/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective: o }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) {
          setRun("idle")
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ""
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          for (const l of lines) if (l.trim()) onEvent(l)
        }
        if (buf.trim()) onEvent(buf)
      } catch {
        if (!ctrl.signal.aborted) setRun("idle")
      }
    },
    [run, onEvent]
  )

  const selectedAgent = agents.find((a) => a.id === selected) ?? null
  const activeAgents = agents.filter((a) => !retired.has(a.id) && a.status !== "done")
  const lastStream = stream[stream.length - 1]

  const orderedSections = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections])

  const send = () => {
    const t = input.trim()
    if (!t) return
    setInput("")
    launch(t)
  }

  // ── Idle: centered objective entry ──
  if (run === "idle") {
    return (
      <main className="relative flex h-dvh flex-col overflow-hidden text-white">
        <ShaderBackground fixed calm focus />
        <LiquidGlassFilters />
        <TopBar phase={null} elapsed={0} stats={stats} title="" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-xl">
            <Share2 className="size-5 text-white/80" strokeWidth={1.5} />
          </span>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            {userName ? `${userName}, what should we research?` : "What should we research?"}
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/45">
            Give one objective. A team of ~20 agents plans it, searches the live web, verifies findings, and writes a cited report.
          </p>
          <div className="mt-6 w-full max-w-[620px]">
            <Composer value={input} onChange={setInput} onSend={send} running={false} placeholder="e.g. The state of India's EV market in 2026 — adoption, policy, key players, and outlook." big />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => { setInput(s); launch(s) }} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/50 backdrop-blur-xl transition-colors hover:text-white">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Running / done: three-column research workspace ──
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden text-white">
      <ShaderBackground fixed calm focus />
      <LiquidGlassFilters />
      <TopBar phase={phase} elapsed={elapsed} stats={stats} title={title || objective} done={run === "done"} />

      <div className="relative z-10 flex min-h-0 flex-1 gap-2 px-2 pb-2">
        {/* LEFT: agents (dynamic) */}
        <AgentsPanel
          agents={agents}
          retired={retired}
          activeCount={activeAgents.length}
          selected={selected}
          onSelect={(id) => { setSelected(id); }}
          phase={phase}
        />

        {/* CENTER: report / web */}
        <section className="liquid-glass liquid-glass-soft glass-panel flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-white/[0.06] px-2">
            <Tab active={tab === "report"} onClick={() => setTab("report")} icon={<FileText className="size-3.5" />} label="Report" />
            <Tab active={tab === "web"} onClick={() => setTab("web")} icon={<Network className="size-3.5" />} label="Agent web" />
            <span className="ml-auto pr-2 text-[11px] text-white/35">{sections.length} sections · {findings.length} findings</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "report" ? (
              <ReportView title={title} summary={summary} sections={orderedSections} phase={phase} running={run === "running"} sourceCount={stats.sources} />
            ) : (
              <AgentWeb agents={agents} retired={retired} selected={selected} onSelect={setSelected} phase={phase} stats={stats} />
            )}
          </div>
        </section>

        {/* RIGHT: detail / sources */}
        <AgentDetail
          agent={selectedAgent}
          sources={sources}
          findings={findings}
          onClose={() => setSelected(null)}
        />
      </div>

      {/* bottom: glass composer */}
      <div className="relative z-20 flex flex-col items-center px-2 pb-3">
        {run === "running" && lastStream && (
          <p className="mb-1.5 max-w-[90%] truncate text-center text-[12px] text-white/35">
            <span className="text-white/55">{lastStream.fromName}</span> · {lastStream.text}
          </p>
        )}
        <div className="w-full max-w-[720px]">
          <Composer value={input} onChange={setInput} onSend={send} running={run === "running"} placeholder="New objective…" />
        </div>
      </div>
    </main>
  )
}

const SUGGESTIONS = [
  "Compare the top 3 AI coding assistants in 2026",
  "The economics of desalination at scale",
  "How CBDCs are being rolled out worldwide",
]

function TopBar({ phase, elapsed, stats, title, done }: { phase: Phase | null; elapsed: number; stats: Stats; title: string; done?: boolean }) {
  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Link href="/chat" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 backdrop-blur-xl transition-colors hover:text-white">
          <ArrowLeft className="size-3" /> Exit
        </Link>
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/30">
          <Share2 className="size-3" /> Harness
        </span>
        {title && <span className="hidden max-w-[360px] truncate text-[12px] text-white/45 sm:block">{title}</span>}
      </div>
      {phase && (
        <div className="flex items-center gap-3 text-[12px]">
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="size-1.5 rounded-full" style={{ background: PHASE_META[phase].color }} />
            <span className="text-white/60">{PHASE_META[phase].label}</span>
          </span>
          <Stat n={stats.sources} label="sources" />
          <Stat n={stats.findings} label="findings" />
          <Stat n={stats.agentsActive} label="active" />
          <span className="font-mono tabular-nums text-white/50">{fmt(elapsed)}</span>
          {done && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-300 backdrop-blur-xl">Complete</span>}
        </div>
      )}
    </header>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="hidden items-center gap-1 md:flex">
      <span className="tabular-nums text-white/75">{n}</span>
      <span className="text-white/30">{label}</span>
    </span>
  )
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${active ? "bg-white/10 text-white" : "text-white/45 hover:text-white"}`}>
      {icon}
      {label}
    </button>
  )
}

function Composer({ value, onChange, onSend, running, placeholder, big }: { value: string; onChange: (v: string) => void; onSend: () => void; running: boolean; placeholder: string; big?: boolean }) {
  return (
    <div className={`liquid-glass liquid-glass-soft glass-panel flex items-end gap-2 rounded-2xl px-3 ${big ? "py-3" : "py-2.5"}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        rows={big ? 2 : 1}
        placeholder={placeholder}
        className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-[14px] leading-relaxed text-white outline-none placeholder:text-white/30"
      />
      <button
        onClick={onSend}
        disabled={!value.trim() || running}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-90 disabled:opacity-30"
      >
        {running ? <Square className="size-3" /> : <ArrowUp className="size-4" />}
      </button>
    </div>
  )
}
