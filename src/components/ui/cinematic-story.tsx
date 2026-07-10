"use client"

import { useEffect, useRef, useState } from "react"
import { Brain, Search, Mail, FileText } from "lucide-react"
import { Reveal } from "@/components/ui/reveal"

// ── Scroll-driven storytelling (Apple product-page style) ────────────────────
// Each act is a tall wrapper with a sticky full-screen stage inside; the stage's
// animation is driven directly by how far the wrapper has been scrolled, so the
// product assembles under your thumb instead of on a timer.

// 0..1 progress through a wrapper element (rAF-throttled).
function useScrollProgress(ref: React.RefObject<HTMLDivElement | null>, reduced: boolean): number {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const total = r.height - window.innerHeight
        const scrolled = Math.min(Math.max(-r.top, 0), total)
        setP(total > 0 ? scrolled / total : 0)
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [ref, reduced])
  return reduced ? 0.7 : p
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return reduced
}

// Map progress p into [a,b] → 0..1, clamped.
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))

// Shared act scaffolding: sticky stage with an eyebrow + giant headline.
function Act({
  height = "260vh",
  eyebrow,
  headline,
  p,
  children,
  wrapRef,
}: {
  height?: string
  eyebrow: string
  headline: string
  p: number
  children: React.ReactNode
  wrapRef: React.RefObject<HTMLDivElement | null>
}) {
  const headIn = seg(p, 0.02, 0.16)
  const actOut = 1 - seg(p, 0.92, 1)
  return (
    <div ref={wrapRef} className="relative" style={{ height }}>
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6">
        <div style={{ opacity: actOut }} className="flex w-full flex-col items-center">
          <p
            className="mb-3 text-xs font-medium uppercase tracking-[0.26em] text-white/35"
            style={{ opacity: headIn, transform: `translateY(${(1 - headIn) * 14}px)` }}
          >
            {eyebrow}
          </p>
          <h2
            className="mb-12 text-center text-5xl font-semibold tracking-tight text-foreground sm:mb-16 sm:text-7xl"
            style={{ opacity: headIn, transform: `translateY(${(1 - headIn) * 22}px)` }}
          >
            {headline}
          </h2>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Act 1: It focuses — the world dims around your work ─────────────────────
function ActFocus({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const p = useScrollProgress(ref, reduced)
  const dim = seg(p, 0.2, 0.55) // the world recedes
  const pills = seg(p, 0.45, 0.65) // controls arrive
  const secs = 1500 - Math.round(seg(p, 0.2, 0.9) * 312) // 25:00 → 19:48
  const mm = Math.floor(secs / 60)
  const ss = String(secs % 60).padStart(2, "0")

  return (
    <Act wrapRef={ref} p={p} eyebrow="01 · Focus mode" headline="It focuses.">
      <div className="relative w-full max-w-xl">
        {/* the page you're reading */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d11] p-7 sm:p-9">
          <div className="space-y-3.5">
            {[0.92, 1, 0.8, 1, 0.66].map((w, i) => (
              <div
                key={i}
                className="h-2.5 rounded-full"
                style={{
                  width: `${w * 100}%`,
                  background: i === 2 ? `rgba(255,255,255,${0.25 + dim * 0.5})` : `rgba(255,255,255,${0.16 - dim * 0.1})`,
                }}
              />
            ))}
          </div>
          {/* dimming veil with a clear band around the focused line */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: dim * 0.85,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.85) 38%, transparent 47%, transparent 60%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.85) 100%)",
            }}
          />
        </div>

        {/* focus controls slide in */}
        <div
          className="absolute -top-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/12 bg-[#101217]/90 p-1 pr-3.5 shadow-2xl backdrop-blur-md"
          style={{ opacity: pills, transform: `translate(-50%, ${(1 - pills) * 16}px)` }}
        >
          {["Light", "Deep", "Study"].map((l, i) => (
            <span
              key={l}
              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                i === 1 ? "bg-white text-black" : "text-white/45"
              }`}
            >
              {l}
            </span>
          ))}
          <span className="ml-1.5 font-mono text-[11px] tabular-nums text-white/55">
            {mm}:{ss}
          </span>
        </div>
      </div>
    </Act>
  )
}

// ── Act 2: It builds — a report assembles line by line ──────────────────────
function ActBuild({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const p = useScrollProgress(ref, reduced)
  const card = seg(p, 0.12, 0.3)
  const bars = seg(p, 0.55, 0.8)
  const lines = [0, 1, 2, 3, 4].map((i) => seg(p, 0.28 + i * 0.06, 0.4 + i * 0.06))

  return (
    <Act wrapRef={ref} p={p} eyebrow="02 · Deliverables" headline="It builds.">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#0e1015] shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)]"
        style={{ opacity: card, transform: `translateY(${(1 - card) * 40}px) scale(${0.94 + card * 0.06})` }}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3">
          <FileText className="size-3.5 text-white/50" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/45">physics-report.pdf</span>
          <span className="ml-auto font-mono text-[10px] tabular-nums text-white/30">{Math.round(seg(p, 0.25, 0.85) * 100)}%</span>
        </div>
        <div className="px-6 py-6">
          <div className="h-4 rounded bg-white/30" style={{ width: `${lines[0] * 70}%` }} />
          <div className="mt-2 h-2 rounded bg-white/[0.12]" style={{ width: `${lines[0] * 42}%` }} />
          <div className="mt-5 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-2 rounded bg-white/[0.09]" style={{ width: `${lines[i] * (i === 3 ? 74 : 96)}%` }} />
            ))}
          </div>
          {/* a chart grows in */}
          <div className="mt-6 flex h-24 items-end gap-2.5">
            {[45, 72, 34, 88, 58, 76].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-white/25" style={{ height: `${h * bars}%` }} />
            ))}
          </div>
          <div className="mt-4 h-2 rounded bg-white/[0.09]" style={{ width: `${lines[4] * 58}%` }} />
        </div>
      </div>
    </Act>
  )
}

// ── Act 3: It multiplies — agents fan out and work in parallel ──────────────
function ActSwarm({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const p = useScrollProgress(ref, reduced)
  const fan = seg(p, 0.18, 0.5)
  const work = seg(p, 0.5, 0.9)
  const agents = [
    { label: "research", x: -132, y: -78 },
    { label: "design", x: 138, y: -64 },
    { label: "write", x: -120, y: 84 },
    { label: "build", x: 128, y: 92 },
  ]

  return (
    <Act wrapRef={ref} p={p} eyebrow="03 · Agent swarm" headline="It multiplies.">
      <div className="relative h-64 w-full max-w-lg sm:h-72">
        {/* connection lines draw as agents fan out */}
        <svg className="absolute inset-0 size-full" viewBox="-200 -140 400 280" aria-hidden>
          {agents.map((a) => (
            <line
              key={a.label}
              x1="0"
              y1="0"
              x2={a.x * fan}
              y2={a.y * fan}
              stroke="rgba(255,255,255,0.14)"
              strokeDasharray="3 5"
            />
          ))}
        </svg>

        {/* orchestrator */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-[#15171d] shadow-2xl">
            <svg viewBox="0 0 100 100" className="size-7">
              <path
                d="M70,32 C70,21 56,17 45,21 C33,25 31,37 43,43 C55,49 70,51 69,63 C68,76 52,81 39,76 C32,74 29,69 28,63"
                fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* agents fly outward from the center */}
        {agents.map((a, i) => (
          <div
            key={a.label}
            className="absolute left-1/2 top-1/2 z-10"
            style={{
              transform: `translate(calc(-50% + ${a.x * fan}px), calc(-50% + ${a.y * fan}px))`,
              opacity: Math.max(fan, 0.001),
            }}
          >
            <div className="flex items-center gap-2 rounded-full border border-white/12 bg-[#101217] py-1.5 pl-2 pr-3.5 shadow-xl">
              <span
                className="size-2 rounded-full"
                style={{ background: work > (i + 1) / 5 ? "rgb(110 231 183 / 0.9)" : "rgba(255,255,255,0.75)" }}
              />
              <span className="text-[11px] font-medium text-white/70">{a.label}</span>
            </div>
          </div>
        ))}

        {/* progress */}
        <div className="absolute inset-x-8 -bottom-10">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
            <span>4 agents · parallel</span>
            <span className="tabular-nums">{Math.min(4, Math.floor(work * 5))}/4 done</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-white/40" style={{ width: `${work * 100}%` }} />
          </div>
        </div>
      </div>
    </Act>
  )
}

const TRIO = [
  { icon: Brain, title: "Remembers you", body: "Goals, preferences, and projects carry across every chat." },
  { icon: Search, title: "Grounded answers", body: "Live web search with real citations — not guesswork." },
  { icon: Mail, title: "Inbox, handled", body: "Read, triage, and send Gmail from the conversation." },
]

export function CinematicStory() {
  const reduced = useReducedMotion()
  return (
    <section id="capabilities" className="relative z-10 w-full bg-background">
      <ActFocus reduced={reduced} />
      <ActBuild reduced={reduced} />
      <ActSwarm reduced={reduced} />

      {/* quiet supporting trio */}
      <div className="px-6 pb-28 pt-10 sm:pb-36">
        <Reveal className="mx-auto max-w-6xl">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {TRIO.map((t) => {
              const Icon = t.icon
              return (
                <div key={t.title} className="flex flex-col gap-3 bg-[#0a0b0e] p-7 transition-colors hover:bg-[#0d0e12]">
                  <Icon className="size-[18px] text-white/50" />
                  <div>
                    <h4 className="text-[15px] font-semibold text-foreground">{t.title}</h4>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{t.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
