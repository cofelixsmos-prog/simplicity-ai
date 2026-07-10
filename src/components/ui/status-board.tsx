"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, RefreshCw, ArrowRight } from "lucide-react"

type Health = "operational" | "degraded" | "down" | "unconfigured"

interface Service {
  id: string
  label: string
  role: string
  status: Health
  latency: number | null
}

interface StatusData {
  overall: Health
  services: Service[]
  checkedAt: number
}

const POLL_MS = 5000

const DOT: Record<Health, string> = {
  operational: "bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.55)]",
  degraded: "bg-amber-400 shadow-[0_0_8px_1px_rgba(251,191,36,0.5)]",
  down: "bg-red-400 shadow-[0_0_8px_1px_rgba(248,113,113,0.55)]",
  unconfigured: "bg-white/20",
}

const OVERALL_TEXT: Record<Health, string> = {
  operational: "All systems operational",
  degraded: "Partial outage",
  down: "Major outage",
  unconfigured: "Awaiting setup",
}

// A live status board shown while Simplicity is down. Polls /api/status, shows
// per-service health + latency, and calls onRecover once everything is back — so
// the user is returned to their work automatically.
export function StatusBoard({
  failedModel,
  onClose,
  onRecover,
}: {
  failedModel?: string
  onClose: () => void
  onRecover: () => void
}) {
  const [data, setData] = useState<StatusData | null>(null)
  const [checking, setChecking] = useState(true)
  const [nextIn, setNextIn] = useState(POLL_MS / 1000)
  const recoveredRef = useRef(false)
  const polls = useRef(0)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const r = await fetch("/api/status", { cache: "no-store" })
      if (r.ok) {
        const d: StatusData = await r.json()
        setData(d)
        polls.current += 1
        // Recover after two confirming checks — so the board is visibly shown for
        // a few seconds before it self-heals.
        if (d.overall === "operational" && !recoveredRef.current && polls.current >= 2) {
          recoveredRef.current = true
          onRecover()
        }
      }
    } catch {
      /* leave prior data; the outage is the point */
    } finally {
      setNextIn(POLL_MS / 1000)
    }
  }, [onRecover])

  useEffect(() => {
    check()
    const id = setInterval(check, POLL_MS)
    return () => clearInterval(id)
  }, [check])

  useEffect(() => {
    const id = setInterval(() => setNextIn((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])

  const overall = data?.overall ?? "down"
  const services = data?.services ?? PLACEHOLDER

  const rightText = (s: Service) =>
    s.status === "operational" ? (s.latency != null ? `${s.latency} ms` : "live") : s.status === "degraded" ? "degraded" : s.status === "unconfigured" ? "off" : "down"

  return (
    <div className="liquid-glass liquid-glass-soft glass-panel w-[min(92vw,430px)] p-7">
      {/* Brand + dismiss */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-[6px] bg-white text-[10px] font-bold text-black">S</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">Simplicity status</span>
        </div>
        <button
          onClick={onClose}
          className="inline-flex size-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Overall */}
      <div className="mb-6 flex items-center gap-3">
        <span className="relative flex size-3">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${DOT[overall]}`} />
          <span className={`relative inline-flex size-3 rounded-full ${DOT[overall]}`} />
        </span>
        <div>
          <h3 className="text-[21px] font-semibold tracking-tight text-white">{OVERALL_TEXT[overall]}</h3>
          <p className="text-[12.5px] text-white/45">Live health · localhost:3000</p>
        </div>
      </div>

      {/* Services */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
        {services.map((s, i) => {
          const failed = failedModel === s.id
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between px-4 py-3 ${
                i > 0 ? "border-t border-white/[0.06]" : ""
              } ${failed ? "bg-white/[0.035]" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-md border border-white/12 font-mono text-[11px] text-white/85">
                  {s.label}
                </span>
                <div className="leading-tight">
                  <span className="block text-[13.5px] text-white/80">{s.role}</span>
                  {failed && (
                    <span className="text-[10px] uppercase tracking-wide text-white/35">this request</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] tabular-nums text-white/40">{rightText(s)}</span>
                <span className={`size-2 rounded-full ${DOT[s.status]}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Recheck line */}
      <div className="mt-4 flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1.5 text-[11.5px] text-white/40">
          <RefreshCw className={`size-3 ${checking ? "animate-spin" : ""}`} />
          {checking ? "checking…" : `rechecks in ${nextIn}s`}
        </span>
        <button
          onClick={check}
          className="text-[11.5px] text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Retry now
        </button>
      </div>

      {/* Primary action */}
      <button
        onClick={onClose}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99]"
      >
        Back to work
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </button>
      <p className="mt-3 text-center text-[11px] text-white/35">
        Or wait — we&apos;ll bring you back the moment it&apos;s all green.
      </p>
    </div>
  )
}

const PLACEHOLDER: Service[] = [
  { id: "r1", label: "R1", role: "model", status: "down", latency: null },
  { id: "search", label: "Search", role: "web", status: "down", latency: null },
]
