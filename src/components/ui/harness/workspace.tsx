"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUp, Share2, FileText } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { PHASE_META, type Collab, type Finding, type HarnessAgent, type Phase, type Question, type ReportSection } from "@/lib/harness/types"
import { AgentStage } from "@/components/ui/harness/agent-stage"
import { ClarifyFlow, ClarifyLoading } from "@/components/ui/harness/clarify-flow"
import { ReportReveal } from "@/components/ui/harness/report-reveal"

type Stage = "idle" | "clarifying" | "running" | "done"

export function HarnessWorkspace({ userName }: { userName: string | null }) {
  const [stage, setStage] = useState<Stage>("idle")
  const [input, setInput] = useState("")
  const [objective, setObjective] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")

  const [phase, setPhase] = useState<Phase>("plan")
  const [caption, setCaption] = useState("")
  const [agents, setAgents] = useState<HarnessAgent[]>([])
  const [collabs, setCollabs] = useState<Collab[]>([])
  const [sections, setSections] = useState<ReportSection[]>([])
  const [sourceCount, setSourceCount] = useState(0)
  const [findings, setFindings] = useState<Finding[]>([])

  // clarify
  const [clarify, setClarify] = useState<{ intro: string; questions: Question[] } | null>(null)
  const [midQuestion, setMidQuestion] = useState<Question | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  // live steering
  const [runId, setRunId] = useState<string | null>(null)
  const [steerInput, setSteerInput] = useState("")
  const [steerNote, setSteerNote] = useState("")

  const answersRef = useRef<Record<string, string>>({})

  const onEvent = useCallback((line: string) => {
    let ev: Record<string, unknown>
    try {
      ev = JSON.parse(line)
    } catch {
      return
    }
    switch (ev.t) {
      case "run":
        setRunId(String(ev.runId))
        break
      case "steer_ack":
        setSteerNote(`Adjusting: “${String(ev.text).slice(0, 60)}”`)
        setTimeout(() => setSteerNote(""), 4000)
        break
      case "agent_retire":
        setAgents((p) => p.map((a) => (a.id === ev.id ? { ...a, status: "done" } : a)))
        break
      case "objective":
        setSummary(String(ev.summary ?? ""))
        setTitle(String(ev.title ?? ""))
        break
      case "phase":
        setPhase(ev.phase as Phase)
        break
      case "caption":
        setCaption(String(ev.text ?? ""))
        break
      case "agent_spawn":
        setAgents((p) => [...p, ev.agent as HarnessAgent])
        break
      case "agent_update":
        setAgents((p) => p.map((a) => (a.id === ev.id ? { ...a, ...(ev.patch as Partial<HarnessAgent>) } : a)))
        break
      case "hold":
        setAgents((p) => p.map((a) => (a.id === ev.id ? { ...a, status: "held" } : a)))
        break
      case "resume":
        setAgents((p) => p.map((a) => (a.id === ev.id ? { ...a, status: "reading" } : a)))
        break
      case "collab":
        setCollabs((p) => [...p.slice(-40), ev.collab as Collab])
        break
      case "source":
        setSourceCount((n) => n + 1)
        break
      case "finding":
        setFindings((p) => {
          const f = ev.finding as Finding
          const i = p.findIndex((x) => x.id === f.id)
          if (i >= 0) {
            const c = [...p]
            c[i] = f
            return c
          }
          return [...p, f]
        })
        break
      case "vote":
        setFindings((p) => p.map((f) => (f.id === ev.findingId ? { ...f, votes: Number(ev.votes), featured: Boolean(ev.featured), cut: Boolean(ev.cut) } : f)))
        break
      case "section":
        setSections((p) => {
          const s = ev.section as ReportSection
          const i = p.findIndex((x) => x.id === s.id)
          if (i >= 0) {
            const c = [...p]
            c[i] = s
            return c
          }
          return [...p, s]
        })
        break
      case "ask":
        setMidQuestion(ev.question as Question)
        break
      case "done":
        setSummary(String(ev.summary ?? ""))
        setTitle(String(ev.title ?? ""))
        setStage("done")
        setTimeout(() => setReportOpen(true), 900)
        break
      case "error":
        setStage("done")
        break
    }
  }, [])

  const startRun = useCallback(
    async (obj: string, answers: Record<string, string>) => {
      setStage("running")
      setPhase("plan")
      setCaption("The executive is designing the research strategy…")
      setAgents([])
      setCollabs([])
      setSections([])
      setFindings([])
      setSourceCount(0)
      try {
        const res = await fetch("/api/harness/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective: obj, clarifications: answers }),
        })
        if (!res.ok || !res.body) {
          setStage("idle")
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
        setStage("idle")
      }
    },
    [onEvent]
  )

  // Begin: fetch clarifying questions, then show the full-screen flow.
  const begin = useCallback(async () => {
    const obj = input.trim()
    if (!obj) return
    setObjective(obj)
    setInput("")
    setStage("clarifying")
    setClarify(null)
    try {
      const res = await fetch("/api/harness/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: obj }),
      })
      const data = await res.json().catch(() => ({ intro: "", questions: [] }))
      const questions = (data.questions ?? []) as Question[]
      if (!questions.length) {
        // nothing to ask — go straight to the run
        startRun(obj, {})
        return
      }
      setClarify({ intro: data.intro ?? "", questions })
    } catch {
      startRun(obj, {})
    }
  }, [input, startRun])

  const newRun = () => {
    setStage("idle")
    setReportOpen(false)
    setObjective("")
    setTitle("")
    setSummary("")
    setRunId(null)
  }

  // Send a live steer into the running research (re-plans, adds/removes agents).
  const sendSteer = async () => {
    const m = steerInput.trim()
    if (!m || !runId) return
    setSteerInput("")
    setSteerNote("Sent to the executive…")
    try {
      await fetch("/api/harness/steer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, message: m }),
      })
    } catch {
      setSteerNote("Couldn't reach the run.")
    }
  }

  const badge = stage === "done" ? "Complete" : PHASE_META[phase]?.label ?? ""

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden text-white">
      <ShaderBackground fixed calm />
      <LiquidGlassFilters />

      {/* top bar */}
      <header className="relative z-20 flex h-12 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 backdrop-blur-xl transition-colors hover:text-white">
            <ArrowLeft className="size-3" /> Exit
          </Link>
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/30">
            <Share2 className="size-3" /> Harness
          </span>
          {objective && stage !== "idle" && <span className="hidden max-w-[340px] truncate text-[12px] text-white/40 sm:block">{title || objective}</span>}
        </div>
        {stage === "running" || stage === "done" ? (
          <div className="flex items-center gap-3 text-[12px]">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: stage === "done" ? "#34D399" : PHASE_META[phase]?.color }} />
              <span className="text-white/60">{badge}</span>
            </span>
            {stage === "done" && (
              <button onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:opacity-90">
                <FileText className="size-3.5" /> View report
              </button>
            )}
          </div>
        ) : null}
      </header>

      {/* stage */}
      <section className="relative z-10 min-h-0 flex-1">
        {stage === "idle" ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-xl">
              <Share2 className="size-5 text-white/80" strokeWidth={1.5} />
            </span>
            <h1 className="text-[26px] font-semibold tracking-tight text-white">
              {userName ? `${userName}, what should we research?` : "What should we research?"}
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/45">
              Give one objective. The executive will ask a few questions, then a team of agents researches it live and delivers a cited report.
            </p>
          </div>
        ) : (
          <AgentStage agents={agents} collabs={collabs} phase={phase} caption={stage === "done" ? "Research complete." : caption} />
        )}
      </section>

      {/* composer (idle only) */}
      {stage === "idle" && (
        <div className="relative z-20 flex justify-center px-4 pb-6">
          <div className="liquid-glass liquid-glass-soft glass-panel flex w-full max-w-[640px] items-end gap-2 rounded-2xl px-3 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  begin()
                }
              }}
              rows={2}
              placeholder="e.g. The state of India's EV market in 2026 — adoption, policy, key players, outlook."
              className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-[14px] leading-relaxed text-white outline-none placeholder:text-white/30"
            />
            <button onClick={begin} disabled={!input.trim()} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-90 disabled:opacity-30">
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* live steer bar (running only) — redirect the research on the fly */}
      {stage === "running" && (
        <div className="relative z-20 flex flex-col items-center px-4 pb-5">
          {steerNote && <p className="mb-1.5 text-[12px] text-sky-300/80">{steerNote}</p>}
          <div className="liquid-glass liquid-glass-soft glass-panel flex w-full max-w-[560px] items-center gap-2 rounded-full px-3 py-1.5">
            <textarea
              value={steerInput}
              onChange={(e) => setSteerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendSteer()
                }
              }}
              rows={1}
              placeholder="Steer the research… e.g. 'focus on EV funds, not the market' or 'dig deeper on Elon Musk'"
              className="max-h-20 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30"
            />
            <button
              onClick={sendSteer}
              disabled={!steerInput.trim() || !runId}
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <ArrowUp className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="relative z-20 flex justify-center px-4 pb-6">
          <button onClick={newRun} className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-white/80 backdrop-blur-xl transition-colors hover:text-white">
            New objective
          </button>
        </div>
      )}

      {/* full-screen clarify */}
      {stage === "clarifying" && !clarify && <ClarifyLoading />}
      {stage === "clarifying" && clarify && (
        <ClarifyFlow
          intro={clarify.intro}
          questions={clarify.questions}
          onDone={(answers) => {
            answersRef.current = answers
            setClarify(null)
            startRun(objective, answers)
          }}
          onSkip={() => {
            setClarify(null)
            startRun(objective, {})
          }}
        />
      )}

      {/* mid-run question */}
      {midQuestion && (
        <ClarifyFlow
          intro="One quick decision to keep going:"
          questions={[midQuestion]}
          onDone={(a) => {
            answersRef.current = { ...answersRef.current, ...a }
            setMidQuestion(null)
          }}
          onSkip={() => setMidQuestion(null)}
        />
      )}

      {/* full-screen report reveal */}
      {reportOpen && (
        <ReportReveal title={title} summary={summary} sections={sections} sourceCount={sourceCount} onClose={() => setReportOpen(false)} />
      )}
    </main>
  )
}
