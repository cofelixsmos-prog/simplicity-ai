"use client"

import { useEffect, useRef, useState } from "react"

// An animated growth line chart. Draws in when scrolled into view. Used on the
// Companies and Bench Labs pages to show the adoption trajectory.

interface Point {
  label: string
  value: number
}

const DEFAULT_DATA: Point[] = [
  { label: "Month 1", value: 200 },
  { label: "Month 2", value: 1200 },
  { label: "Month 3", value: 2600 },
  { label: "Month 4", value: 4000 },
]

export function GrowthGraph({
  data = DEFAULT_DATA,
  accent = "#38BDF8",
  caption = "Bench Labs — user growth",
}: {
  data?: Point[]
  accent?: string
  caption?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const W = 720
  const H = 300
  const padL = 52
  const padB = 40
  const padT = 24
  const padR = 24
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const max = Math.max(...data.map((d) => d.value)) * 1.1
  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => padT + plotH - (v / max) * plotH

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ")
  const areaPath = `${linePath} L${x(data.length - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z`

  // gridlines
  const ticks = 4
  const grid = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = (max / ticks) * i
    return { v, yy: y(v) }
  })

  return (
    <div ref={ref} className="w-full">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* gridlines + y labels */}
          {grid.map((g, i) => (
            <g key={i}>
              <line x1={padL} y1={g.yy} x2={W - padR} y2={g.yy} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <text x={padL - 10} y={g.yy + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.4)">
                {g.v >= 1000 ? `${(g.v / 1000).toFixed(1)}k` : Math.round(g.v)}
              </text>
            </g>
          ))}

          {/* area */}
          <path
            d={areaPath}
            fill="url(#growthArea)"
            style={{ opacity: shown ? 1 : 0, transition: "opacity 1.2s ease 0.4s" }}
          />

          {/* line — drawn in with a dash animation */}
          <path
            d={linePath}
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 2000,
              strokeDashoffset: shown ? 0 : 2000,
              transition: "stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1)",
            }}
          />

          {/* points + value labels */}
          {data.map((d, i) => (
            <g key={i} style={{ opacity: shown ? 1 : 0, transition: `opacity 0.5s ease ${0.6 + i * 0.25}s` }}>
              <circle cx={x(i)} cy={y(d.value)} r="4.5" fill={accent} />
              <circle cx={x(i)} cy={y(d.value)} r="9" fill={accent} opacity="0.15" />
              <text x={x(i)} y={y(d.value) - 14} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff">
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
              </text>
              <text x={x(i)} y={H - 14} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)">
                {d.label}
              </text>
            </g>
          ))}
        </svg>
        {caption && <p className="mt-2 text-center text-[12px] text-white/40">{caption}</p>}
      </div>
    </div>
  )
}
