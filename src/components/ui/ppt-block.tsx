"use client"

import { useState } from "react"
import { Download, Presentation, Loader2 } from "lucide-react"

interface ChartSpec {
  type: "bar" | "line" | "pie"
  labels: string[]
  datasets: { label?: string; data: number[] }[]
}
interface Slide {
  title?: string
  subtitle?: string
  bullets?: string[]
  layout?: "title" | "content"
  chart?: ChartSpec
}
export interface PptSpec {
  title?: string
  slides: Slide[]
}

export function parsePpt(code: string): PptSpec | null {
  try {
    const o = JSON.parse(code.trim())
    if (!o || !Array.isArray(o.slides)) return null
    return o as PptSpec
  } catch {
    return null
  }
}

// Mini slide thumbnail
function SlideThumb({ slide, index }: { slide: Slide; index: number }) {
  const isTitle = slide.layout === "title" || index === 0
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-[#15151a] to-[#0c0c0f] p-4">
      {isTitle ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-white sm:text-base">{slide.title}</p>
          {slide.subtitle && (
            <p className="mt-1 text-[10px] text-white/50">{slide.subtitle}</p>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <p className="mb-2 text-xs font-semibold text-white">{slide.title}</p>
          <div className="flex flex-1 gap-2">
            <ul className="flex-1 space-y-1">
              {(slide.bullets ?? []).slice(0, 5).map((b, i) => (
                <li key={i} className="flex gap-1 text-[9px] leading-snug text-white/60">
                  <span className="text-white/40">•</span>
                  <span className="line-clamp-2">{b}</span>
                </li>
              ))}
            </ul>
            {slide.chart && (
              <div className="flex w-1/3 items-end gap-0.5">
                {(slide.chart.datasets[0]?.data ?? []).slice(0, 6).map((v, i, arr) => {
                  const max = Math.max(...arr, 1)
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-white/40"
                      style={{ height: `${(v / max) * 100}%` }}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function PptBlock({
  code,
  streaming = false,
  compact = false,
}: {
  code: string
  streaming?: boolean
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const spec = parsePpt(code)

  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Building presentation…
      </div>
    )
  }
  if (!spec) return null

  const download = async () => {
    setBusy(true)
    try {
      const PptxGenJS = (await import("pptxgenjs")).default
      const pptx = new PptxGenJS()
      pptx.defineLayout({ name: "W", width: 10, height: 5.625 })
      pptx.layout = "W"

      spec.slides.forEach((s, idx) => {
        const slide = pptx.addSlide()
        slide.background = { color: "0B0B0C" }
        const isTitle = s.layout === "title" || idx === 0

        if (isTitle) {
          slide.addText(s.title ?? "", {
            x: 0.5, y: 2.1, w: 9, h: 1, align: "center",
            fontSize: 32, bold: true, color: "FFFFFF",
          })
          if (s.subtitle)
            slide.addText(s.subtitle, {
              x: 0.5, y: 3.1, w: 9, h: 0.6, align: "center",
              fontSize: 14, color: "A1A1AA",
            })
        } else {
          slide.addText(s.title ?? "", {
            x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 22, bold: true, color: "FFFFFF",
          })
          if (s.bullets?.length)
            slide.addText(
              s.bullets.map((b) => ({ text: b, options: { bullet: true } })),
              {
                x: 0.6, y: 1.4, w: s.chart ? 5 : 8.8, h: 3.5,
                fontSize: 14, color: "D4D4D8", lineSpacingMultiple: 1.3,
              }
            )
          if (s.chart) {
            const chartType =
              s.chart.type === "line"
                ? pptx.ChartType.line
                : s.chart.type === "pie"
                  ? pptx.ChartType.pie
                  : pptx.ChartType.bar
            slide.addChart(
              chartType,
              s.chart.datasets.map((d) => ({
                name: d.label ?? "Series",
                labels: s.chart!.labels,
                values: d.data,
              })),
              { x: 5.7, y: 1.3, w: 3.8, h: 3.5, showLegend: true, chartColors: ["FFFFFF", "A1A1AA", "71717A"] }
            )
          }
        }
      })

      await pptx.writeFile({ fileName: `${(spec.title ?? "presentation").replace(/[^\w]+/g, "_")}.pptx` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="my-4 rounded-xl border border-border bg-[#0b0b0c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Presentation className="size-4 text-white/70" />
          <span className="text-sm font-medium text-white">
            {spec.title ?? "Presentation"}
          </span>
          <span className="text-xs text-white/40">· {spec.slides.length} slides</span>
        </div>
        <button
          onClick={download}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          .pptx
        </button>
      </div>
      <div className={`grid gap-3 ${compact ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2"}`}>
        {spec.slides.map((s, i) => (
          <SlideThumb key={i} slide={s} index={i} />
        ))}
      </div>
    </div>
  )
}
