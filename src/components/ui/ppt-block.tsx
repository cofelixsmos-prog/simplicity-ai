"use client"

import { useState } from "react"
import { Download, Presentation, Loader2 } from "lucide-react"

interface ChartSpec {
  type: "bar" | "line" | "pie"
  labels: string[]
  datasets: { label?: string; data: number[] }[]
}
interface Column {
  heading?: string
  bullets: string[]
}
interface Metric {
  value: string
  label: string
}
type Layout = "title" | "section" | "content" | "columns" | "metrics" | "quote" | "agenda" | "closing"
interface Slide {
  layout?: Layout
  title?: string
  subtitle?: string
  eyebrow?: string
  bullets?: string[]
  items?: string[]
  columns?: Column[]
  metrics?: Metric[]
  quote?: string
  attribution?: string
  chart?: ChartSpec
}
export interface PptSpec {
  title?: string
  subtitle?: string
  theme?: "light" | "dark" | "navy"
  accent?: string
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

// ── Theme palettes (hex, no leading #) ──────────────────────────────────────
interface Theme {
  bg: string
  text: string
  muted: string
  panel: string
  line: string
  accent: string
  onAccent: string
}
const PALETTES: Record<string, Omit<Theme, "accent" | "onAccent">> = {
  light: { bg: "FFFFFF", text: "0F172A", muted: "64748B", panel: "F1F5F9", line: "E2E8F0" },
  dark: { bg: "0B0B0C", text: "FFFFFF", muted: "A1A1AA", panel: "17171B", line: "27272A" },
  navy: { bg: "0F172A", text: "F8FAFC", muted: "94A3B8", panel: "1E293B", line: "334155" },
}
const DEFAULT_ACCENT: Record<string, string> = { light: "2563EB", dark: "6366F1", navy: "38BDF8" }

function resolveTheme(spec: PptSpec): Theme {
  const key = spec.theme && PALETTES[spec.theme] ? spec.theme : "light"
  const base = PALETTES[key]
  const accent = (spec.accent ?? DEFAULT_ACCENT[key]).replace("#", "")
  return { ...base, accent, onAccent: "FFFFFF" }
}

const FONT = "Calibri"
const FONT_LIGHT = "Calibri Light"

// ── Live preview thumbnails (theme-aware, one per layout) ───────────────────
function hx(h: string) {
  return `#${h}`
}

function SlideThumb({ slide, index, theme }: { slide: Slide; index: number; theme: Theme }) {
  const layout: Layout = slide.layout ?? (index === 0 ? "title" : "content")
  const base = "relative aspect-video w-full overflow-hidden rounded-lg border"

  if (layout === "title") {
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: hx(theme.accent) }} />
        <div className="flex h-full flex-col justify-center px-4 pl-5">
          {slide.eyebrow && (
            <p className="text-[7px] font-semibold tracking-widest" style={{ color: hx(theme.accent) }}>
              {slide.eyebrow.toUpperCase()}
            </p>
          )}
          <div className="my-1 h-1 w-8 rounded-full" style={{ background: hx(theme.accent) }} />
          <p className="text-[13px] font-bold leading-tight" style={{ color: hx(theme.text) }}>
            {slide.title}
          </p>
          {slide.subtitle && (
            <p className="mt-1 text-[9px]" style={{ color: hx(theme.muted) }}>
              {slide.subtitle}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (layout === "section" || layout === "closing") {
    return (
      <div className={base} style={{ background: hx(theme.accent), borderColor: hx(theme.accent) }}>
        <div className="flex h-full flex-col justify-center px-4 text-white">
          {slide.eyebrow && <p className="text-[8px] font-semibold tracking-widest opacity-80">{slide.eyebrow}</p>}
          <p className="mt-0.5 text-[13px] font-bold leading-tight">{slide.title}</p>
          {slide.subtitle && <p className="mt-1 text-[8px] opacity-80">{slide.subtitle}</p>}
        </div>
      </div>
    )
  }

  if (layout === "metrics") {
    const metrics = (slide.metrics ?? []).slice(0, 4)
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col p-3">
          <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
            {slide.title}
          </p>
          <div className="mt-auto flex items-stretch gap-1.5">
            {metrics.map((m, i) => (
              <div
                key={i}
                className="min-w-0 flex-1 overflow-hidden rounded"
                style={{ background: hx(theme.panel) }}
              >
                <div className="h-0.5 w-full" style={{ background: hx(theme.accent) }} />
                <div className="p-1.5">
                  <p className="truncate text-[13px] font-bold leading-none" style={{ color: hx(theme.accent) }}>
                    {m.value}
                  </p>
                  <p className="mt-0.5 truncate text-[6px]" style={{ color: hx(theme.muted) }}>
                    {m.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (layout === "quote") {
    return (
      <div className={base} style={{ background: hx(theme.panel), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col justify-center px-4">
          <span className="font-serif text-[20px] leading-none" style={{ color: hx(theme.accent) }}>
            &ldquo;
          </span>
          <p className="line-clamp-3 text-[10px] font-medium leading-snug" style={{ color: hx(theme.text) }}>
            {slide.quote}
          </p>
          {slide.attribution && (
            <p className="mt-1 text-[8px]" style={{ color: hx(theme.muted) }}>
              — {slide.attribution}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (layout === "columns") {
    const cols = (slide.columns ?? []).slice(0, 2)
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col p-3">
          <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
            {slide.title}
          </p>
          <div className="mt-2 grid flex-1 grid-cols-2 gap-2">
            {cols.map((c, i) => (
              <div key={i}>
                <p className="text-[8px] font-semibold" style={{ color: hx(theme.accent) }}>
                  {c.heading}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {c.bullets.slice(0, 3).map((b, j) => (
                    <li key={j} className="truncate text-[7px]" style={{ color: hx(theme.muted) }}>
                      • {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (layout === "agenda") {
    const items = (slide.items ?? slide.bullets ?? []).slice(0, 5)
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col p-3">
          <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
            {slide.title ?? "Agenda"}
          </p>
          <ul className="mt-2 space-y-1">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  className="flex size-3 items-center justify-center rounded-full text-[6px] font-bold text-white"
                  style={{ background: hx(theme.accent) }}
                >
                  {i + 1}
                </span>
                <span className="truncate text-[8px]" style={{ color: hx(theme.muted) }}>
                  {it}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // content (with optional chart)
  return (
    <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
      <div className="flex h-full flex-col p-3">
        {slide.eyebrow && (
          <p className="text-[6px] font-semibold tracking-widest" style={{ color: hx(theme.accent) }}>
            {slide.eyebrow.toUpperCase()}
          </p>
        )}
        <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
          {slide.title}
        </p>
        <div className="mt-1 h-0.5 w-6 rounded-full" style={{ background: hx(theme.accent) }} />
        <div className="mt-2 flex flex-1 gap-2">
          <ul className="flex-1 space-y-1">
            {(slide.bullets ?? []).slice(0, 5).map((b, i) => (
              <li key={i} className="flex gap-1 text-[8px] leading-snug" style={{ color: hx(theme.muted) }}>
                <span style={{ color: hx(theme.accent) }}>▪</span>
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
                    className="flex-1 rounded-sm"
                    style={{ height: `${(v / max) * 100}%`, background: hx(theme.accent) }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
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
        Designing presentation…
      </div>
    )
  }
  if (!spec) return null

  const theme = resolveTheme(spec)

  const download = async () => {
    setBusy(true)
    try {
      const PptxGenJS = (await import("pptxgenjs")).default
      const pptx = new PptxGenJS()
      pptx.defineLayout({ name: "W", width: 10, height: 5.625 })
      pptx.layout = "W"
      const W = 10
      const total = spec.slides.length
      type PSlide = ReturnType<typeof pptx.addSlide>

      // footer label + slide number on body slides
      const addChrome = (slide: PSlide, n: number) => {
        slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 5.32, w: 9, h: 0.012, fill: { color: theme.line }, line: { width: 0 } })
        if (spec.title)
          slide.addText(spec.title, { x: 0.5, y: 5.36, w: 7, h: 0.22, fontSize: 8, color: theme.muted, fontFace: FONT })
        slide.addText(`${n}`, {
          x: W - 1.0, y: 5.36, w: 0.5, h: 0.22, align: "right", fontSize: 8, bold: true, color: theme.accent, fontFace: FONT,
        })
      }

      // accent kicker + title + underline; returns the y where content can start
      const addHeader = (slide: PSlide, s: Slide): number => {
        let y = 0.45
        if (s.eyebrow) {
          slide.addText(s.eyebrow.toUpperCase(), {
            x: 0.52, y, w: 9, h: 0.3, fontSize: 11, bold: true, color: theme.accent, charSpacing: 3, fontFace: FONT,
          })
          y += 0.32
        }
        slide.addText(s.title ?? "", { x: 0.5, y, w: 9, h: 0.7, fontSize: 24, bold: true, color: theme.text, fontFace: FONT })
        slide.addShape(pptx.ShapeType.rect, { x: 0.52, y: y + 0.62, w: 0.7, h: 0.06, fill: { color: theme.accent }, line: { width: 0 } })
        return y + 0.95
      }

      const squareBullets = (bullets: string[]) =>
        bullets.map((b) => ({ text: b, options: { bullet: { characterCode: "25AA", indent: 18 } } }))

      spec.slides.forEach((s, idx) => {
        const slide = pptx.addSlide()
        const layout: Layout = s.layout ?? (idx === 0 ? "title" : "content")

        // ── TITLE / cover: accent spine + brand mark + big type ──
        if (layout === "title") {
          slide.background = { color: theme.bg }
          slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 5.625, fill: { color: theme.accent }, line: { width: 0 } })
          slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.55, w: 0.22, h: 0.22, fill: { color: theme.accent }, line: { width: 0 } })
          if (s.eyebrow)
            slide.addText(s.eyebrow.toUpperCase(), { x: 0.62, y: 1.7, w: 8, h: 0.3, fontSize: 12, bold: true, color: theme.accent, charSpacing: 3, fontFace: FONT })
          slide.addShape(pptx.ShapeType.rect, { x: 0.64, y: 2.1, w: 0.9, h: 0.12, fill: { color: theme.accent }, line: { width: 0 } })
          slide.addText(s.title ?? "", { x: 0.6, y: 2.3, w: 9, h: 1.5, fontSize: 40, bold: true, color: theme.text, fontFace: FONT_LIGHT, valign: "top" })
          if (s.subtitle)
            slide.addText(s.subtitle, { x: 0.64, y: 3.75, w: 8.5, h: 0.6, fontSize: 16, color: theme.muted, fontFace: FONT })
          slide.addShape(pptx.ShapeType.rect, { x: 0.64, y: 5.0, w: 3, h: 0.015, fill: { color: theme.line }, line: { width: 0 } })
          return
        }

        // ── SECTION divider / CLOSING (accent background) ──
        if (layout === "section" || layout === "closing") {
          slide.background = { color: theme.accent }
          slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.85, w: 0.22, h: 0.22, fill: { color: theme.onAccent }, line: { width: 0 } })
          if (s.eyebrow)
            slide.addText(s.eyebrow.toUpperCase(), { x: 0.62, y: 2.25, w: 8, h: 0.4, fontSize: 14, bold: true, color: theme.onAccent, charSpacing: 3, fontFace: FONT })
          slide.addText(s.title ?? (layout === "closing" ? "Thank you" : ""), {
            x: 0.6, y: 2.6, w: 8.8, h: 1.3, fontSize: 36, bold: true, color: theme.onAccent, fontFace: FONT_LIGHT,
          })
          if (s.subtitle)
            slide.addText(s.subtitle, { x: 0.64, y: 3.9, w: 8.5, h: 0.6, fontSize: 15, color: theme.onAccent, fontFace: FONT })
          return
        }

        slide.background = { color: theme.bg }

        // ── METRICS callouts (cards w/ top accent bar) ──
        if (layout === "metrics") {
          const top = addHeader(slide, s)
          const metrics = (s.metrics ?? []).slice(0, 4)
          const n = Math.max(metrics.length, 1)
          const gap = 0.3
          const cw = (9 - gap * (n - 1)) / n
          metrics.forEach((m, i) => {
            const x = 0.5 + i * (cw + gap)
            slide.addShape(pptx.ShapeType.roundRect, { x, y: top, w: cw, h: 1.9, fill: { color: theme.accent, transparency: 90 }, line: { width: 0 }, rectRadius: 0.08 })
            slide.addShape(pptx.ShapeType.rect, { x, y: top, w: cw, h: 0.07, fill: { color: theme.accent }, line: { width: 0 } })
            slide.addText(m.value, { x: x + 0.18, y: top + 0.3, w: cw - 0.36, h: 0.9, fontSize: 36, bold: true, color: theme.accent, fontFace: FONT })
            slide.addText(m.label, { x: x + 0.2, y: top + 1.2, w: cw - 0.4, h: 0.5, fontSize: 12, color: theme.muted, fontFace: FONT })
          })
          addChrome(slide, idx + 1)
          return
        }

        // ── QUOTE ──
        if (layout === "quote") {
          slide.background = { color: theme.panel }
          slide.addText("“", { x: 0.5, y: 0.7, w: 2, h: 1.4, fontSize: 100, bold: true, color: theme.accent, fontFace: FONT_LIGHT })
          slide.addText(s.quote ?? "", { x: 1.3, y: 1.9, w: 7.4, h: 2, fontSize: 26, italic: true, color: theme.text, fontFace: FONT_LIGHT })
          slide.addShape(pptx.ShapeType.rect, { x: 1.35, y: 3.95, w: 0.5, h: 0.05, fill: { color: theme.accent }, line: { width: 0 } })
          if (s.attribution)
            slide.addText(s.attribution, { x: 1.35, y: 4.05, w: 7.4, h: 0.5, fontSize: 14, bold: true, color: theme.muted, fontFace: FONT })
          addChrome(slide, idx + 1)
          return
        }

        // ── COLUMNS (two-up) ──
        if (layout === "columns") {
          const top = addHeader(slide, s)
          const cols = (s.columns ?? []).slice(0, 2)
          cols.forEach((c, i) => {
            const x = 0.5 + i * 4.7
            slide.addShape(pptx.ShapeType.roundRect, { x, y: top, w: 4.3, h: 3.3, fill: { color: theme.accent, transparency: 94 }, line: { color: theme.line, width: 1 }, rectRadius: 0.08 })
            if (c.heading)
              slide.addText(c.heading, { x: x + 0.25, y: top + 0.2, w: 3.8, h: 0.5, fontSize: 16, bold: true, color: theme.accent, fontFace: FONT })
            if (c.bullets?.length)
              slide.addText(squareBullets(c.bullets), { x: x + 0.25, y: top + 0.85, w: 3.85, h: 2.3, fontSize: 14, color: theme.text, fontFace: FONT, lineSpacingMultiple: 1.3 })
          })
          addChrome(slide, idx + 1)
          return
        }

        // ── AGENDA (numbered list with accent badges) ──
        if (layout === "agenda") {
          const top = addHeader(slide, { ...s, title: s.title ?? "Agenda" })
          const items = (s.items ?? s.bullets ?? []).slice(0, 6)
          const rowH = Math.min(0.72, (4.6 - top) / Math.max(items.length, 1))
          items.forEach((it, i) => {
            const y = top + i * rowH
            slide.addShape(pptx.ShapeType.ellipse, { x: 0.55, y: y + 0.04, w: 0.42, h: 0.42, fill: { color: theme.accent }, line: { width: 0 } })
            slide.addText(`${i + 1}`, { x: 0.55, y: y + 0.04, w: 0.42, h: 0.42, align: "center", valign: "middle", fontSize: 14, bold: true, color: theme.onAccent, fontFace: FONT })
            slide.addText(it, { x: 1.2, y, w: 8, h: rowH, valign: "middle", fontSize: 15, color: theme.text, fontFace: FONT })
          })
          addChrome(slide, idx + 1)
          return
        }

        // ── CONTENT (bullets + optional chart) ──
        const top = addHeader(slide, s)
        if (s.bullets?.length)
          slide.addText(squareBullets(s.bullets), {
            x: 0.55, y: top, w: s.chart ? 5 : 8.9, h: 3.4, fontSize: 15, color: theme.text, fontFace: FONT, lineSpacingMultiple: 1.4, valign: "top",
          })
        if (s.chart) {
          const chartType =
            s.chart.type === "line" ? pptx.ChartType.line : s.chart.type === "pie" ? pptx.ChartType.pie : pptx.ChartType.bar
          slide.addChart(
            chartType,
            s.chart.datasets.map((d) => ({ name: d.label ?? "Series", labels: s.chart!.labels, values: d.data })),
            {
              x: s.bullets?.length ? 5.7 : 1.5, y: top, w: s.bullets?.length ? 3.8 : 7, h: 3.3,
              showLegend: s.chart.datasets.length > 1, legendPos: "b", legendColor: theme.muted, legendFontSize: 9,
              chartColors: [theme.accent, "94A3B8", "CBD5E1", "64748B", theme.muted],
              showValue: false, catAxisLabelColor: theme.muted, valAxisLabelColor: theme.muted,
              catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
            }
          )
        }
        addChrome(slide, idx + 1)
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
          <span className="text-sm font-medium text-white">{spec.title ?? "Presentation"}</span>
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
          <SlideThumb key={i} slide={s} index={i} theme={theme} />
        ))}
      </div>
    </div>
  )
}
