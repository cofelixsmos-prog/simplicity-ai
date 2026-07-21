// Shared presentation builder. Runs in BOTH the browser (instant download from
// the inline preview) and Node (create_ppt → a real stored file that can be
// emailed or saved), so the deck the user previews is the deck they get.
//
// pptxgenjs supports both environments; the only difference is the output call,
// which is why buildPptx() returns the deck and the callers choose how to emit.

export interface PptChartSpec {
  type: "bar" | "line" | "pie"
  labels: string[]
  datasets: { label?: string; data: number[] }[]
}
export interface PptColumn {
  heading?: string
  bullets: string[]
}
export interface PptMetric {
  value: string
  label: string
}
export interface PptStep {
  title: string
  text?: string
}
export interface PptTimelineItem {
  date: string
  title: string
  text?: string
}

export type PptLayout =
  | "title"
  | "section"
  | "content"
  | "columns"
  | "metrics"
  | "quote"
  | "agenda"
  | "closing"
  // Visual layouts — these are what keep a deck from being a wall of bullets.
  | "process"
  | "timeline"
  | "comparison"
  | "bignumber"

export interface PptSlide {
  layout?: PptLayout
  title?: string
  subtitle?: string
  eyebrow?: string
  bullets?: string[]
  items?: string[]
  columns?: PptColumn[]
  metrics?: PptMetric[]
  quote?: string
  attribution?: string
  chart?: PptChartSpec
  // process / timeline / comparison / bignumber
  steps?: PptStep[]
  timeline?: PptTimelineItem[]
  left?: { heading: string; items: string[] }
  right?: { heading: string; items: string[] }
  value?: string
  caption?: string
  note?: string
}

export interface PptSpec {
  title?: string
  subtitle?: string
  theme?: "light" | "dark" | "navy"
  accent?: string
  slides: PptSlide[]
}

// ── Theme ───────────────────────────────────────────────────────────────────

export interface PptTheme {
  bg: string
  text: string
  muted: string
  panel: string
  line: string
  accent: string
  onAccent: string
}

const PALETTES: Record<string, Omit<PptTheme, "accent" | "onAccent">> = {
  light: { bg: "FFFFFF", text: "0F172A", muted: "64748B", panel: "F1F5F9", line: "E2E8F0" },
  dark: { bg: "0B0B0C", text: "FFFFFF", muted: "A1A1AA", panel: "17171B", line: "27272A" },
  navy: { bg: "0F172A", text: "F8FAFC", muted: "94A3B8", panel: "1E293B", line: "334155" },
}
const DEFAULT_ACCENT: Record<string, string> = { light: "2563EB", dark: "6366F1", navy: "38BDF8" }

export function resolveTheme(spec: PptSpec): PptTheme {
  const key = spec.theme && PALETTES[spec.theme] ? spec.theme : "light"
  const base = PALETTES[key]
  const accent = (spec.accent ?? DEFAULT_ACCENT[key]).replace("#", "")
  return { ...base, accent, onAccent: "FFFFFF" }
}

export const FONT = "Calibri"
export const FONT_LIGHT = "Calibri Light"

// ── Input sanitizing ────────────────────────────────────────────────────────
// Same rationale as the PDF sanitizer: model output arrives with nested objects
// and stringified numbers. Coerce so neither the preview nor the render breaks.

function asText(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ")
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    for (const k of ["text", "label", "title", "value", "name"]) {
      if (typeof o[k] === "string") return o[k] as string
    }
    return ""
  }
  return String(v)
}
function asStringArray(v: unknown): string[] {
  if (!v) return []
  return (Array.isArray(v) ? v : [v]).map(asText).filter((s) => s.length > 0)
}
function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(/[^0-9.eE+-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

const LAYOUTS: PptLayout[] = [
  "title", "section", "content", "columns", "metrics", "quote", "agenda",
  "closing", "process", "timeline", "comparison", "bignumber",
]

/** Normalize raw model output into valid slides; unusable ones are dropped. */
export function normalizeSlides(raw: unknown): PptSlide[] {
  if (!Array.isArray(raw)) return []
  const out: PptSlide[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const s = item as Record<string, unknown>
    const layout = String(s.layout ?? "")
    const slide: PptSlide = {
      layout: (LAYOUTS.includes(layout as PptLayout) ? layout : undefined) as PptLayout | undefined,
      title: asText(s.title) || undefined,
      subtitle: asText(s.subtitle) || undefined,
      eyebrow: asText(s.eyebrow) || undefined,
      bullets: asStringArray(s.bullets),
      items: asStringArray(s.items),
      quote: asText(s.quote) || undefined,
      attribution: asText(s.attribution) || undefined,
      value: asText(s.value) || undefined,
      caption: asText(s.caption) || undefined,
      note: asText(s.note) || undefined,
    }

    if (Array.isArray(s.columns)) {
      slide.columns = s.columns
        .map((c) => {
          const o = (c ?? {}) as Record<string, unknown>
          return { heading: asText(o.heading) || undefined, bullets: asStringArray(o.bullets) }
        })
        .filter((c) => c.heading || c.bullets.length)
    }
    if (Array.isArray(s.metrics)) {
      slide.metrics = s.metrics
        .map((m) => {
          const o = (m ?? {}) as Record<string, unknown>
          return { value: asText(o.value), label: asText(o.label) }
        })
        .filter((m) => m.value || m.label)
    }
    if (Array.isArray(s.steps)) {
      slide.steps = s.steps
        .map((t) => {
          const o = (t ?? {}) as Record<string, unknown>
          return { title: asText(o.title ?? o.text), text: asText(o.text) || undefined }
        })
        .filter((t) => t.title)
    }
    if (Array.isArray(s.timeline)) {
      slide.timeline = s.timeline
        .map((t) => {
          const o = (t ?? {}) as Record<string, unknown>
          return { date: asText(o.date), title: asText(o.title), text: asText(o.text) || undefined }
        })
        .filter((t) => t.title || t.date)
    }
    const side = (v: unknown) => {
      const o = (v ?? {}) as Record<string, unknown>
      return { heading: asText(o.heading), items: asStringArray(o.items) }
    }
    if (s.left) slide.left = side(s.left)
    if (s.right) slide.right = side(s.right)

    const c = s.chart as Record<string, unknown> | undefined
    if (c && typeof c === "object") {
      const ct = String(c.type ?? "bar")
      const labels = asStringArray(c.labels)
      const datasets = (Array.isArray(c.datasets) ? c.datasets : [])
        .map((d) => {
          const o = (d ?? {}) as Record<string, unknown>
          return { label: asText(o.label) || undefined, data: (Array.isArray(o.data) ? o.data : []).map(asNumber) }
        })
        .filter((d) => d.data.length)
      if (labels.length && datasets.length) {
        slide.chart = { type: (["bar", "line", "pie"].includes(ct) ? ct : "bar") as "bar" | "line" | "pie", labels, datasets }
      }
    }

    // Keep a slide only if it will actually show something.
    const hasContent =
      slide.title || slide.subtitle || slide.quote || slide.value ||
      slide.bullets?.length || slide.items?.length || slide.columns?.length ||
      slide.metrics?.length || slide.steps?.length || slide.timeline?.length ||
      slide.left?.items.length || slide.right?.items.length || slide.chart
    if (hasContent) out.push(slide)
  }
  return out
}

export function parsePpt(code: string): PptSpec | null {
  try {
    const o = JSON.parse(code.trim())
    if (!o || !Array.isArray(o.slides)) return null
    return { ...o, slides: normalizeSlides(o.slides) } as PptSpec
  } catch {
    return null
  }
}

// ── Deck builder ────────────────────────────────────────────────────────────

/**
 * Build the deck. Returns the pptxgenjs instance so the caller decides output:
 * browser → writeFile(), server → write({ outputType: "nodebuffer" }).
 */
export async function buildPptx(spec: PptSpec) {
  const PptxGenJS = (await import("pptxgenjs")).default
  const theme = resolveTheme(spec)
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: "W", width: 10, height: 5.625 })
  pptx.layout = "W"
  const W = 10
  type PSlide = ReturnType<typeof pptx.addSlide>

  const addChrome = (slide: PSlide, n: number) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 5.32, w: 9, h: 0.012, fill: { color: theme.line }, line: { width: 0 } })
    if (spec.title)
      slide.addText(spec.title, { x: 0.5, y: 5.36, w: 7, h: 0.22, fontSize: 8, color: theme.muted, fontFace: FONT })
    slide.addText(`${n}`, {
      x: W - 1.0, y: 5.36, w: 0.5, h: 0.22, align: "right", fontSize: 8, bold: true, color: theme.accent, fontFace: FONT,
    })
  }

  const addHeader = (slide: PSlide, s: PptSlide): number => {
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
    const layout: PptLayout = s.layout ?? (idx === 0 ? "title" : "content")

    // ── TITLE / cover ──
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

    // ── SECTION / CLOSING ──
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

    // ── BIG NUMBER — one stat, stated loudly ──
    if (layout === "bignumber") {
      const top = addHeader(slide, s)
      slide.addText(s.value ?? "", {
        x: 0.5, y: top + 0.2, w: 9, h: 1.9, align: "center", fontSize: 96, bold: true, color: theme.accent, fontFace: FONT_LIGHT,
      })
      if (s.caption)
        slide.addText(s.caption, { x: 1, y: top + 2.15, w: 8, h: 0.5, align: "center", fontSize: 18, color: theme.text, fontFace: FONT })
      if (s.note)
        slide.addText(s.note, { x: 1.5, y: top + 2.7, w: 7, h: 0.5, align: "center", fontSize: 12, color: theme.muted, fontFace: FONT })
      addChrome(slide, idx + 1)
      return
    }

    // ── PROCESS — numbered chevrons across the slide ──
    if (layout === "process") {
      const top = addHeader(slide, s)
      const steps = (s.steps ?? []).slice(0, 5)
      const n = Math.max(steps.length, 1)
      const gap = 0.18
      const cw = (9 - gap * (n - 1)) / n
      steps.forEach((st, i) => {
        const x = 0.5 + i * (cw + gap)
        slide.addShape(pptx.ShapeType.roundRect, {
          x, y: top + 0.35, w: cw, h: 2.2, fill: { color: theme.accent, transparency: 92 },
          line: { color: theme.accent, width: 1 }, rectRadius: 0.08,
        })
        // step badge
        slide.addShape(pptx.ShapeType.ellipse, { x: x + cw / 2 - 0.24, y: top + 0.1, w: 0.48, h: 0.48, fill: { color: theme.accent }, line: { width: 0 } })
        slide.addText(`${i + 1}`, {
          x: x + cw / 2 - 0.24, y: top + 0.1, w: 0.48, h: 0.48, align: "center", valign: "middle",
          fontSize: 16, bold: true, color: theme.onAccent, fontFace: FONT,
        })
        slide.addText(st.title, {
          x: x + 0.14, y: top + 0.75, w: cw - 0.28, h: 0.5, align: "center", fontSize: 14, bold: true, color: theme.text, fontFace: FONT,
        })
        if (st.text)
          slide.addText(st.text, {
            x: x + 0.14, y: top + 1.28, w: cw - 0.28, h: 1.1, align: "center", fontSize: 11, color: theme.muted, fontFace: FONT, valign: "top",
          })
        // connector arrow between steps
        if (i < steps.length - 1)
          slide.addText("›", {
            x: x + cw, y: top + 1.2, w: gap, h: 0.4, align: "center", fontSize: 20, bold: true, color: theme.accent, fontFace: FONT,
          })
      })
      addChrome(slide, idx + 1)
      return
    }

    // ── TIMELINE — horizontal rail with dated milestones ──
    if (layout === "timeline") {
      const top = addHeader(slide, s)
      const items = (s.timeline ?? []).slice(0, 5)
      const n = Math.max(items.length, 1)
      const railY = top + 1.25
      slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: railY, w: 8.8, h: 0.035, fill: { color: theme.line }, line: { width: 0 } })
      const colW = 8.8 / n
      items.forEach((it, i) => {
        const cx = 0.6 + colW * i + colW / 2
        slide.addText(it.date, {
          x: cx - colW / 2, y: railY - 0.75, w: colW, h: 0.35, align: "center", fontSize: 12, bold: true, color: theme.accent, fontFace: FONT,
        })
        slide.addShape(pptx.ShapeType.ellipse, { x: cx - 0.11, y: railY - 0.09, w: 0.22, h: 0.22, fill: { color: theme.accent }, line: { color: theme.bg, width: 2 } })
        slide.addText(it.title, {
          x: cx - colW / 2 + 0.08, y: railY + 0.32, w: colW - 0.16, h: 0.45, align: "center", fontSize: 13, bold: true, color: theme.text, fontFace: FONT,
        })
        if (it.text)
          slide.addText(it.text, {
            x: cx - colW / 2 + 0.08, y: railY + 0.8, w: colW - 0.16, h: 1.1, align: "center", fontSize: 10.5, color: theme.muted, fontFace: FONT, valign: "top",
          })
      })
      addChrome(slide, idx + 1)
      return
    }

    // ── COMPARISON — two panels, muted vs accent ──
    if (layout === "comparison") {
      const top = addHeader(slide, s)
      const sides = [s.left, s.right]
      sides.forEach((side, i) => {
        if (!side) return
        const x = 0.5 + i * 4.7
        const isRight = i === 1
        slide.addShape(pptx.ShapeType.roundRect, {
          x, y: top, w: 4.3, h: 3.2,
          fill: { color: isRight ? theme.accent : theme.muted, transparency: isRight ? 90 : 94 },
          line: { color: isRight ? theme.accent : theme.line, width: 1 }, rectRadius: 0.08,
        })
        slide.addShape(pptx.ShapeType.rect, { x, y: top, w: 4.3, h: 0.45, fill: { color: isRight ? theme.accent : theme.muted }, line: { width: 0 } })
        slide.addText(side.heading, {
          x: x + 0.2, y: top + 0.03, w: 3.9, h: 0.4, valign: "middle", fontSize: 14, bold: true, color: theme.onAccent, fontFace: FONT,
        })
        slide.addText(
          side.items.map((t) => ({ text: t, options: { bullet: { characterCode: isRight ? "2713" : "2013", indent: 18 } } })),
          { x: x + 0.25, y: top + 0.65, w: 3.85, h: 2.4, fontSize: 13, color: theme.text, fontFace: FONT, lineSpacingMultiple: 1.35, valign: "top" }
        )
      })
      addChrome(slide, idx + 1)
      return
    }

    // ── METRICS ──
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

    // ── COLUMNS ──
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

    // ── AGENDA ──
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

  return pptx
}

/** Server-side: real .pptx bytes, for storing/emailing. */
export async function renderPptxBuffer(spec: PptSpec): Promise<Uint8Array> {
  const pptx = await buildPptx(spec)
  const out = (await pptx.write({ outputType: "nodebuffer" })) as unknown as Uint8Array
  return out
}

export function pptFileName(spec: PptSpec): string {
  return `${(spec.title ?? "presentation").replace(/[^\w]+/g, "_").slice(0, 80) || "presentation"}.pptx`
}
