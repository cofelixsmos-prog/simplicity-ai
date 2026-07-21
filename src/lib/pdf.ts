// Server-side PDF rendering from the same spec the inline PdfBlock uses, so the
// AI can produce a real PDF file (to attach to email, save to Drive, or offer as
// a download) — not just a client-only preview. jsPDF runs fine in Node.
//
// Diagrams are drawn as NATIVE VECTORS (not rasterized images), so they stay
// crisp at any zoom, keep the file small, and work server-side where there's no
// DOM to run Mermaid in.
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// ── Spec ────────────────────────────────────────────────────────────────────

export interface FlowNode {
  id: string
  text: string
  /** Visual role — shapes the node: process (rect), decision (diamond), start/end (pill). */
  kind?: "process" | "decision" | "terminator" | "input"
}
export interface FlowEdge {
  from: string
  to: string
  label?: string
}

export interface PdfChartSpec {
  type: "bar" | "line" | "pie" | "donut"
  labels: string[]
  datasets: { label?: string; data: number[] }[]
  /** Optional caption rendered under the chart. */
  caption?: string
}

export type PdfBlockSpec =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; columns: string[]; rows: (string | number)[][]; caption?: string }
  | { type: "callout"; text: string; tone?: "info" | "success" | "warn" | "danger"; title?: string }
  | { type: "divider" }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "stats"; items: { value: string; label: string }[] }
  | { type: "columns"; columns: { heading?: string; text?: string; bullets?: string[] }[] }
  | { type: "steps"; items: { title: string; text?: string }[] }
  | { type: "timeline"; items: { date: string; title: string; text?: string }[] }
  | { type: "flowchart"; nodes: FlowNode[]; edges: FlowEdge[]; direction?: "vertical" | "horizontal"; caption?: string }
  | { type: "tree"; root: string; children: { text: string; children?: string[] }[]; caption?: string }
  | { type: "comparison"; left: { heading: string; items: string[] }; right: { heading: string; items: string[] } }
  | { type: "chart"; chart: PdfChartSpec }
  | { type: "pagebreak" }

export interface PdfSpec {
  title?: string
  subtitle?: string
  accent?: string
  /** Visual theme for the whole document. */
  theme?: "light" | "slate" | "warm" | "mono"
  /** Draw a full-page cover instead of a simple title header. */
  cover?: boolean
  /** Small label shown above the title on the cover (e.g. "Quarterly Report"). */
  eyebrow?: string
  /** Footer text (defaults to the title). */
  footer?: string
  blocks: PdfBlockSpec[]
}

// ── Input sanitizing ────────────────────────────────────────────────────────
// Model output is untrusted: text fields arrive as objects ({text:"..."}),
// numbers as strings, rows as scalars. Coerce everything to the shapes the
// renderer and the React preview expect, and drop blocks that can't be saved —
// otherwise a single malformed field crashes the preview or the render.

/** Coerce any value to a display string. Handles the common {text:"..."} wrapper. */
function asText(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ")
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    for (const k of ["text", "label", "title", "value", "name", "content"]) {
      if (typeof o[k] === "string") return o[k] as string
    }
    return ""
  }
  return String(v)
}

function asStringArray(v: unknown): string[] {
  if (!v) return []
  const arr = Array.isArray(v) ? v : [v]
  return arr.map(asText).filter((s) => s.length > 0)
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(/[^0-9.eE+-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

/**
 * Normalize raw model output into valid blocks. Unknown or unusable blocks are
 * dropped; anything salvageable is coerced (never thrown away for a bad field).
 */
export function normalizePdfBlocks(raw: unknown): PdfBlockSpec[] {
  if (!Array.isArray(raw)) return []
  const out: PdfBlockSpec[] = []

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      // A bare string is a reasonable paragraph.
      const t = asText(item)
      if (t) out.push({ type: "paragraph", text: t })
      continue
    }
    const b = item as Record<string, unknown>
    const type = String(b.type ?? "").toLowerCase()

    switch (type) {
      case "heading": {
        const text = asText(b.text)
        const lvl = Math.min(3, Math.max(1, Math.round(asNumber(b.level) || 1))) as 1 | 2 | 3
        if (text) out.push({ type: "heading", text, level: lvl })
        break
      }
      case "paragraph":
      case "text": {
        const text = asText(b.text ?? b.content)
        if (text) out.push({ type: "paragraph", text })
        break
      }
      case "list":
      case "bullets": {
        const items = asStringArray(b.items ?? b.bullets)
        if (items.length) out.push({ type: "list", items, ordered: b.ordered === true })
        break
      }
      case "callout": {
        const text = asText(b.text)
        const tone = String(b.tone ?? "info")
        if (text)
          out.push({
            type: "callout",
            text,
            title: asText(b.title) || undefined,
            tone: (["info", "success", "warn", "danger"].includes(tone) ? tone : "info") as
              | "info" | "success" | "warn" | "danger",
          })
        break
      }
      case "divider":
        out.push({ type: "divider" })
        break
      case "pagebreak":
        out.push({ type: "pagebreak" })
        break
      case "quote": {
        const text = asText(b.text)
        if (text) out.push({ type: "quote", text, attribution: asText(b.attribution) || undefined })
        break
      }
      case "stats":
      case "metrics": {
        const src = Array.isArray(b.items) ? b.items : Array.isArray(b.metrics) ? b.metrics : []
        const items = src
          .map((s) => {
            const o = (s ?? {}) as Record<string, unknown>
            return { value: asText(o.value), label: asText(o.label) }
          })
          .filter((s) => s.value || s.label)
        if (items.length) out.push({ type: "stats", items })
        break
      }
      case "columns": {
        const src = Array.isArray(b.columns) ? b.columns : []
        const columns = src
          .map((c) => {
            const o = (c ?? {}) as Record<string, unknown>
            return {
              heading: asText(o.heading) || undefined,
              text: asText(o.text) || undefined,
              bullets: asStringArray(o.bullets),
            }
          })
          .filter((c) => c.heading || c.text || (c.bullets && c.bullets.length))
        if (columns.length) out.push({ type: "columns", columns })
        break
      }
      case "steps": {
        const src = Array.isArray(b.items) ? b.items : []
        const items = src
          .map((s) => {
            const o = (s ?? {}) as Record<string, unknown>
            return { title: asText(o.title ?? o.text), text: asText(o.text) || undefined }
          })
          .filter((s) => s.title)
        if (items.length) out.push({ type: "steps", items })
        break
      }
      case "timeline": {
        const src = Array.isArray(b.items) ? b.items : []
        const items = src
          .map((s) => {
            const o = (s ?? {}) as Record<string, unknown>
            return { date: asText(o.date), title: asText(o.title), text: asText(o.text) || undefined }
          })
          .filter((s) => s.title || s.date)
        if (items.length) out.push({ type: "timeline", items })
        break
      }
      case "comparison": {
        const side = (v: unknown) => {
          const o = (v ?? {}) as Record<string, unknown>
          return { heading: asText(o.heading), items: asStringArray(o.items) }
        }
        const left = side(b.left)
        const right = side(b.right)
        if (left.items.length || right.items.length) out.push({ type: "comparison", left, right })
        break
      }
      case "flowchart": {
        const rawNodes = Array.isArray(b.nodes) ? b.nodes : []
        const nodes: FlowNode[] = rawNodes
          .map((n, i) => {
            const o = (n ?? {}) as Record<string, unknown>
            const kind = String(o.kind ?? "process")
            return {
              id: asText(o.id) || `n${i}`,
              text: asText(o.text ?? o.label),
              kind: (["process", "decision", "terminator", "input"].includes(kind) ? kind : "process") as
                | "process" | "decision" | "terminator" | "input",
            }
          })
          .filter((n) => n.text)
        const ids = new Set(nodes.map((n) => n.id))
        const edges: FlowEdge[] = (Array.isArray(b.edges) ? b.edges : [])
          .map((e) => {
            const o = (e ?? {}) as Record<string, unknown>
            return { from: asText(o.from), to: asText(o.to), label: asText(o.label) || undefined }
          })
          .filter((e) => ids.has(e.from) && ids.has(e.to))
        if (nodes.length)
          out.push({
            type: "flowchart",
            nodes,
            edges,
            direction: b.direction === "horizontal" ? "horizontal" : "vertical",
            caption: asText(b.caption) || undefined,
          })
        break
      }
      case "tree": {
        const root = asText(b.root)
        const children = (Array.isArray(b.children) ? b.children : [])
          .map((c) => {
            const o = (c ?? {}) as Record<string, unknown>
            return { text: asText(o.text), children: asStringArray(o.children) }
          })
          .filter((c) => c.text)
        if (root && children.length) out.push({ type: "tree", root, children, caption: asText(b.caption) || undefined })
        break
      }
      case "chart": {
        const c = (b.chart ?? b) as Record<string, unknown>
        const ct = String(c.type ?? "bar")
        const labels = asStringArray(c.labels)
        const datasets = (Array.isArray(c.datasets) ? c.datasets : [])
          .map((d) => {
            const o = (d ?? {}) as Record<string, unknown>
            return {
              label: asText(o.label) || undefined,
              data: (Array.isArray(o.data) ? o.data : []).map(asNumber),
            }
          })
          .filter((d) => d.data.length)
        if (labels.length && datasets.length)
          out.push({
            type: "chart",
            chart: {
              type: (["bar", "line", "pie", "donut"].includes(ct) ? ct : "bar") as "bar" | "line" | "pie" | "donut",
              labels,
              datasets,
              caption: asText(c.caption) || undefined,
            },
          })
        break
      }
      case "table": {
        const columns = asStringArray(b.columns ?? b.headers)
        const rows = (Array.isArray(b.rows) ? b.rows : []).map((r) =>
          (Array.isArray(r) ? r : [r]).map((cell) => asText(cell))
        )
        if (columns.length && rows.length)
          out.push({ type: "table", columns, rows, caption: asText(b.caption) || undefined })
        break
      }
      default: {
        // Unknown type — keep the text so content isn't silently lost.
        const text = asText(b.text ?? b.content)
        if (text) out.push({ type: "paragraph", text })
      }
    }
  }
  return out
}

// ── Theme ───────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

interface Palette {
  text: RGB
  muted: RGB
  line: RGB
  panel: RGB
  panelAlt: RGB
  accent: RGB
  onAccent: RGB
  coverBg: RGB
  coverText: RGB
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Mix two colors — used for tints (e.g. a 12% accent wash behind a diagram node).
function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

const WHITE: RGB = [255, 255, 255]

function buildPalette(spec: PdfSpec): Palette {
  const accent = hexToRgb((spec.accent ?? "2563EB").replace("#", ""))
  const themes: Record<string, Omit<Palette, "accent" | "onAccent">> = {
    light: {
      text: hexToRgb("0F172A"),
      muted: hexToRgb("64748B"),
      line: hexToRgb("E2E8F0"),
      panel: hexToRgb("F8FAFC"),
      panelAlt: hexToRgb("F1F5F9"),
      coverBg: accent,
      coverText: WHITE,
    },
    slate: {
      text: hexToRgb("1E293B"),
      muted: hexToRgb("708090"),
      line: hexToRgb("DDE3EA"),
      panel: hexToRgb("F5F7FA"),
      panelAlt: hexToRgb("EDF1F6"),
      coverBg: hexToRgb("0F172A"),
      coverText: WHITE,
    },
    warm: {
      text: hexToRgb("1C1917"),
      muted: hexToRgb("78716C"),
      line: hexToRgb("E7E2DC"),
      panel: hexToRgb("FAF8F5"),
      panelAlt: hexToRgb("F3EFE9"),
      coverBg: hexToRgb("1C1917"),
      coverText: hexToRgb("FAF8F5"),
    },
    mono: {
      text: hexToRgb("111111"),
      muted: hexToRgb("6B6B6B"),
      line: hexToRgb("DDDDDD"),
      panel: hexToRgb("F7F7F7"),
      panelAlt: hexToRgb("EFEFEF"),
      coverBg: hexToRgb("111111"),
      coverText: WHITE,
    },
  }
  const base = themes[spec.theme ?? "light"] ?? themes.light
  // Pick readable text on the accent by luminance.
  const lum = (accent[0] * 299 + accent[1] * 587 + accent[2] * 114) / 1000
  return { ...base, accent, onAccent: lum > 150 ? hexToRgb("0F172A") : WHITE }
}

const TONES: Record<string, string> = {
  info: "2563EB",
  success: "16A34A",
  warn: "D97706",
  danger: "DC2626",
}

// ── Renderer ────────────────────────────────────────────────────────────────

// Returns raw PDF bytes. Uint8Array so this runs unchanged in BOTH the Node
// server (create_pdf) and the browser (the inline download button) — one
// renderer, so the preview and the real file can never drift apart.
export function renderPdf(spec: PdfSpec): Uint8Array {
  const p = buildPalette(spec)
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 56
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - margin * 2
  const bottomLimit = pageH - margin - 28
  let y = margin

  const ensure = (h: number) => {
    if (y + h > bottomLimit) {
      doc.addPage()
      y = margin
    }
  }

  // Rounded rect helper (jsPDF has roundedRect, wrapped for readable calls).
  const box = (x: number, yy: number, w: number, h: number, fill?: RGB, stroke?: RGB, r = 6) => {
    if (fill) doc.setFillColor(...fill)
    if (stroke) {
      doc.setDrawColor(...stroke)
      doc.setLineWidth(1)
    }
    const style = fill && stroke ? "FD" : fill ? "F" : "S"
    doc.roundedRect(x, yy, w, h, r, r, style)
  }

  // Text centered in a box, wrapped, vertically middled.
  const centerText = (text: string, x: number, yy: number, w: number, h: number, size: number, color: RGB, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, w - 12) as string[]
    const lh = size * 1.25
    const startY = yy + h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.35
    lines.forEach((ln, i) => doc.text(ln, x + w / 2, startY + i * lh, { align: "center" }))
    return lines.length
  }

  const arrow = (x1: number, y1: number, x2: number, y2: number, color: RGB, label?: string) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(1.2)
    doc.line(x1, y1, x2, y2)
    // arrowhead
    const ang = Math.atan2(y2 - y1, x2 - x1)
    const size = 5
    doc.setFillColor(...color)
    doc.triangle(
      x2,
      y2,
      x2 - size * Math.cos(ang - Math.PI / 6),
      y2 - size * Math.sin(ang - Math.PI / 6),
      x2 - size * Math.cos(ang + Math.PI / 6),
      y2 - size * Math.sin(ang + Math.PI / 6),
      "F"
    )
    if (label) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(...p.muted)
      doc.text(label, (x1 + x2) / 2 + 5, (y1 + y2) / 2 - 2)
    }
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  if (spec.cover && spec.title) {
    doc.setFillColor(...p.coverBg)
    doc.rect(0, 0, pageW, pageH, "F")
    // subtle accent band
    doc.setFillColor(...p.accent)
    doc.rect(0, pageH * 0.62, pageW, 3, "F")

    let cy = pageH * 0.3
    if (spec.eyebrow) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(...mix(p.coverText, p.coverBg, 0.35))
      doc.text(spec.eyebrow.toUpperCase(), margin, cy, { charSpace: 1.5 })
      cy += 26
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(34)
    doc.setTextColor(...p.coverText)
    const tl = doc.splitTextToSize(spec.title, maxW) as string[]
    tl.forEach((ln, i) => doc.text(ln, margin, cy + i * 40))
    cy += tl.length * 40
    if (spec.subtitle) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(13)
      doc.setTextColor(...mix(p.coverText, p.coverBg, 0.3))
      const sl = doc.splitTextToSize(spec.subtitle, maxW * 0.8) as string[]
      cy += 12
      sl.forEach((ln, i) => doc.text(ln, margin, cy + i * 19))
    }
    doc.addPage()
    y = margin
  } else if (spec.title) {
    // ── Simple title header ────────────────────────────────────────────────
    doc.setFillColor(...p.accent)
    doc.rect(margin, y, 38, 5, "F")
    y += 20
    doc.setFont("helvetica", "bold")
    doc.setFontSize(24)
    doc.setTextColor(...p.text)
    const lines = doc.splitTextToSize(spec.title, maxW) as string[]
    doc.text(lines, margin, y)
    y += lines.length * 26
    if (spec.subtitle) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(12)
      doc.setTextColor(...p.muted)
      const sub = doc.splitTextToSize(spec.subtitle, maxW) as string[]
      y += 6
      doc.text(sub, margin, y)
      y += sub.length * 16
    }
    y += 10
    doc.setDrawColor(...p.line)
    doc.setLineWidth(1)
    doc.line(margin, y, pageW - margin, y)
    y += 22
  }

  // ── Blocks ────────────────────────────────────────────────────────────────
  for (const b of spec.blocks ?? []) {
    switch (b.type) {
      case "pagebreak": {
        doc.addPage()
        y = margin
        break
      }

      case "heading": {
        const lvl = b.level ?? 1
        const size = lvl === 1 ? 16 : lvl === 2 ? 13 : 11.5
        doc.setFont("helvetica", "bold")
        doc.setFontSize(size)
        const lines = doc.splitTextToSize(b.text, maxW - 14) as string[]
        ensure(lines.length * (size + 6) + 16)
        y += 14
        if (lvl === 1) {
          doc.setFillColor(...p.accent)
          doc.rect(margin, y - 10, 4, 14, "F")
          doc.setTextColor(...p.text)
          doc.text(lines, margin + 14, y)
        } else if (lvl === 2) {
          doc.setTextColor(...p.text)
          doc.text(lines, margin, y)
        } else {
          doc.setTextColor(...p.muted)
          doc.text(lines.map((l) => l.toUpperCase()), margin, y, { charSpace: 0.8 })
        }
        y += lines.length * (size + 6)
        break
      }

      case "paragraph": {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10.5)
        doc.setTextColor(...p.text)
        const lines = doc.splitTextToSize(b.text, maxW) as string[]
        ensure(lines.length * 15)
        doc.text(lines, margin, y, { lineHeightFactor: 1.5 })
        y += lines.length * 15 + 9
        break
      }

      case "list": {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10.5)
        b.items.forEach((it, i) => {
          const marker = b.ordered ? `${i + 1}.` : "•"
          const lines = doc.splitTextToSize(it, maxW - 24) as string[]
          ensure(lines.length * 15 + 3)
          doc.setTextColor(...p.accent)
          doc.setFont("helvetica", b.ordered ? "bold" : "normal")
          doc.text(marker, margin + 4, y)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(...p.text)
          doc.text(lines, margin + 24, y, { lineHeightFactor: 1.45 })
          y += lines.length * 15 + 4
        })
        y += 8
        break
      }

      case "callout": {
        const tone = hexToRgb(TONES[b.tone ?? "info"])
        const wash = mix(WHITE, tone, 0.07)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10.5)
        const lines = doc.splitTextToSize(b.text, maxW - 40) as string[]
        const titleH = b.title ? 16 : 0
        const h = lines.length * 15 + 24 + titleH
        ensure(h + 6)
        box(margin, y - 6, maxW, h, wash, mix(WHITE, tone, 0.25), 8)
        doc.setFillColor(...tone)
        doc.rect(margin, y - 6, 3.5, h, "F")
        let ty = y + 10
        if (b.title) {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10.5)
          doc.setTextColor(...tone)
          doc.text(b.title, margin + 18, ty)
          ty += 16
        }
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10.5)
        doc.setTextColor(...p.text)
        doc.text(lines, margin + 18, ty, { lineHeightFactor: 1.45 })
        y += h + 10
        break
      }

      case "divider": {
        ensure(20)
        doc.setDrawColor(...p.line)
        doc.setLineWidth(1)
        doc.line(margin, y, pageW - margin, y)
        y += 20
        break
      }

      case "quote": {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(13)
        const lines = doc.splitTextToSize(b.text, maxW - 46) as string[]
        const h = lines.length * 19 + (b.attribution ? 20 : 0) + 16
        ensure(h)
        doc.setFillColor(...p.accent)
        doc.rect(margin, y - 4, 3, h - 8, "F")
        doc.setTextColor(...p.text)
        doc.text(lines, margin + 22, y + 10, { lineHeightFactor: 1.4 })
        let qy = y + 10 + lines.length * 19
        if (b.attribution) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(9.5)
          doc.setTextColor(...p.muted)
          doc.text(`— ${b.attribution}`, margin + 22, qy + 4)
          qy += 20
        }
        y = qy + 14
        break
      }

      case "stats": {
        const items = b.items.slice(0, 4)
        if (!items.length) break
        const gap = 12
        const w = (maxW - gap * (items.length - 1)) / items.length
        const h = 68
        ensure(h + 12)
        items.forEach((it, i) => {
          const x = margin + i * (w + gap)
          box(x, y, w, h, p.panel, p.line, 8)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(21)
          doc.setTextColor(...p.accent)
          doc.text(it.value, x + w / 2, y + 30, { align: "center" })
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8.5)
          doc.setTextColor(...p.muted)
          const ll = doc.splitTextToSize(it.label, w - 14) as string[]
          ll.slice(0, 2).forEach((ln, j) => doc.text(ln, x + w / 2, y + 48 + j * 11, { align: "center" }))
        })
        y += h + 18
        break
      }

      case "columns": {
        const cols = b.columns.slice(0, 3)
        if (!cols.length) break
        const gap = 16
        const w = (maxW - gap * (cols.length - 1)) / cols.length
        // Measure the tallest column first so they align.
        let maxH = 0
        const measured = cols.map((c) => {
          doc.setFontSize(10)
          const head = c.heading ? 18 : 0
          const textLines = c.text ? (doc.splitTextToSize(c.text, w - 4) as string[]) : []
          const bulletLines = (c.bullets ?? []).map((bt) => doc.splitTextToSize(bt, w - 18) as string[])
          const h = head + textLines.length * 14 + bulletLines.reduce((n, l) => n + l.length * 14 + 3, 0)
          maxH = Math.max(maxH, h)
          return { textLines, bulletLines }
        })
        ensure(maxH + 14)
        cols.forEach((c, i) => {
          const x = margin + i * (w + gap)
          let cy = y
          if (c.heading) {
            doc.setFont("helvetica", "bold")
            doc.setFontSize(11)
            doc.setTextColor(...p.accent)
            doc.text(c.heading, x, cy)
            cy += 18
          }
          doc.setFont("helvetica", "normal")
          doc.setFontSize(10)
          doc.setTextColor(...p.text)
          if (measured[i].textLines.length) {
            doc.text(measured[i].textLines, x, cy, { lineHeightFactor: 1.4 })
            cy += measured[i].textLines.length * 14
          }
          measured[i].bulletLines.forEach((lines) => {
            doc.setTextColor(...p.accent)
            doc.text("•", x, cy)
            doc.setTextColor(...p.text)
            doc.text(lines, x + 12, cy, { lineHeightFactor: 1.4 })
            cy += lines.length * 14 + 3
          })
        })
        y += maxH + 16
        break
      }

      case "steps": {
        const items = b.items.slice(0, 12)
        items.forEach((it, i) => {
          doc.setFontSize(10)
          const textLines = it.text ? (doc.splitTextToSize(it.text, maxW - 46) as string[]) : []
          const h = 18 + textLines.length * 14 + 12
          ensure(h)
          // numbered dot
          doc.setFillColor(...p.accent)
          doc.circle(margin + 11, y + 1, 11, "F")
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.setTextColor(...p.onAccent)
          doc.text(String(i + 1), margin + 11, y + 4.5, { align: "center" })
          // connector to the next step
          if (i < items.length - 1) {
            doc.setDrawColor(...mix(WHITE, p.accent, 0.35))
            doc.setLineWidth(1.5)
            doc.line(margin + 11, y + 13, margin + 11, y + h + 2)
          }
          doc.setFont("helvetica", "bold")
          doc.setFontSize(11)
          doc.setTextColor(...p.text)
          doc.text(it.title, margin + 34, y + 4)
          if (textLines.length) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(10)
            doc.setTextColor(...p.muted)
            doc.text(textLines, margin + 34, y + 20, { lineHeightFactor: 1.4 })
          }
          y += h
        })
        y += 8
        break
      }

      case "timeline": {
        const items = b.items.slice(0, 12)
        const railX = margin + 58
        items.forEach((it, i) => {
          doc.setFontSize(10)
          const textLines = it.text ? (doc.splitTextToSize(it.text, maxW - (railX - margin) - 24) as string[]) : []
          const h = 20 + textLines.length * 14 + 10
          ensure(h)
          // date on the left
          doc.setFont("helvetica", "bold")
          doc.setFontSize(9)
          doc.setTextColor(...p.muted)
          doc.text(it.date, railX - 14, y + 4, { align: "right" })
          // rail + node
          if (i < items.length - 1) {
            doc.setDrawColor(...p.line)
            doc.setLineWidth(1.5)
            doc.line(railX, y + 6, railX, y + h + 4)
          }
          doc.setFillColor(...p.accent)
          doc.circle(railX, y, 4.5, "F")
          doc.setFillColor(...WHITE)
          doc.circle(railX, y, 1.8, "F")
          // content
          doc.setFont("helvetica", "bold")
          doc.setFontSize(11)
          doc.setTextColor(...p.text)
          doc.text(it.title, railX + 14, y + 4)
          if (textLines.length) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(10)
            doc.setTextColor(...p.muted)
            doc.text(textLines, railX + 14, y + 20, { lineHeightFactor: 1.4 })
          }
          y += h
        })
        y += 8
        break
      }

      case "comparison": {
        const gap = 16
        const w = (maxW - gap) / 2
        const sides = [b.left, b.right]
        doc.setFontSize(10)
        const bodyH = Math.max(
          ...sides.map((s) =>
            s.items.reduce((n, it) => n + (doc.splitTextToSize(it, w - 30) as string[]).length * 14 + 5, 0)
          )
        )
        const h = 34 + bodyH + 16
        ensure(h)
        sides.forEach((s, i) => {
          const x = margin + i * (w + gap)
          const tint = i === 0 ? p.panel : mix(WHITE, p.accent, 0.08)
          box(x, y, w, h, tint, p.line, 8)
          doc.setFillColor(...(i === 0 ? p.muted : p.accent))
          doc.roundedRect(x, y, w, 26, 8, 8, "F")
          doc.rect(x, y + 18, w, 8, "F")
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10.5)
          doc.setTextColor(...WHITE)
          doc.text(s.heading, x + w / 2, y + 17, { align: "center" })
          let cy = y + 44
          doc.setFontSize(10)
          s.items.forEach((it) => {
            const lines = doc.splitTextToSize(it, w - 30) as string[]
            doc.setTextColor(...(i === 0 ? p.muted : p.accent))
            doc.setFont("helvetica", "bold")
            doc.text(i === 0 ? "–" : "+", x + 12, cy)
            doc.setFont("helvetica", "normal")
            doc.setTextColor(...p.text)
            doc.text(lines, x + 26, cy, { lineHeightFactor: 1.4 })
            cy += lines.length * 14 + 5
          })
        })
        y += h + 14
        break
      }

      // ── Flowchart: laid out on a simple grid, drawn as vectors ────────────
      case "flowchart": {
        const nodes = b.nodes.slice(0, 14)
        if (!nodes.length) break
        const horizontal = b.direction === "horizontal"
        const nodeW = horizontal ? Math.min(120, (maxW - 40) / Math.max(1, nodes.length)) : 190
        const nodeH = 42
        const gapY = 30
        const gapX = 34
        const totalH = horizontal ? nodeH + 30 : nodes.length * (nodeH + gapY) - gapY + 20
        ensure(totalH + (b.caption ? 20 : 0))

        // Position every node.
        const pos = new Map<string, { x: number; y: number; w: number; h: number }>()
        nodes.forEach((n, i) => {
          const x = horizontal ? margin + i * (nodeW + gapX) : margin + (maxW - nodeW) / 2
          const yy = horizontal ? y : y + i * (nodeH + gapY)
          pos.set(n.id, { x, y: yy, w: nodeW, h: nodeH })
        })

        // Edges first, so boxes paint over the line ends.
        for (const e of b.edges ?? []) {
          const a = pos.get(e.from)
          const c = pos.get(e.to)
          if (!a || !c) continue
          if (horizontal) arrow(a.x + a.w, a.y + a.h / 2, c.x, c.y + c.h / 2, p.line, e.label)
          else arrow(a.x + a.w / 2, a.y + a.h, c.x + c.w / 2, c.y, p.line, e.label)
        }

        // Nodes.
        for (const n of nodes) {
          const q = pos.get(n.id)!
          const kind = n.kind ?? "process"
          if (kind === "decision") {
            // diamond
            doc.setFillColor(...mix(WHITE, p.accent, 0.1))
            doc.setDrawColor(...p.accent)
            doc.setLineWidth(1.2)
            const cx = q.x + q.w / 2
            const cy = q.y + q.h / 2
            doc.lines(
              [
                [q.w / 2, -q.h / 2],
                [q.w / 2, q.h / 2],
                [-q.w / 2, q.h / 2],
                [-q.w / 2, -q.h / 2],
              ],
              cx - q.w / 2,
              cy,
              [1, 1],
              "FD",
              true
            )
            centerText(n.text, q.x, q.y, q.w, q.h, 8.5, p.text, true)
          } else if (kind === "terminator") {
            box(q.x, q.y, q.w, q.h, p.accent, undefined, q.h / 2)
            centerText(n.text, q.x, q.y, q.w, q.h, 9.5, p.onAccent, true)
          } else if (kind === "input") {
            box(q.x, q.y, q.w, q.h, p.panelAlt, p.line, 4)
            centerText(n.text, q.x, q.y, q.w, q.h, 9.5, p.text)
          } else {
            box(q.x, q.y, q.w, q.h, WHITE, p.accent, 6)
            centerText(n.text, q.x, q.y, q.w, q.h, 9.5, p.text)
          }
        }
        y += totalH
        if (b.caption) {
          doc.setFont("helvetica", "italic")
          doc.setFontSize(9)
          doc.setTextColor(...p.muted)
          doc.text(b.caption, margin + maxW / 2, y, { align: "center" })
          y += 18
        }
        y += 6
        break
      }

      // ── Tree / org chart: root with a row of children ─────────────────────
      case "tree": {
        const kids = b.children.slice(0, 5)
        if (!kids.length) break
        const rootW = 170
        const rootH = 40
        const gap = 12
        const kidW = (maxW - gap * (kids.length - 1)) / kids.length
        doc.setFontSize(9)
        const leafRows = Math.max(...kids.map((k) => (k.children ?? []).length), 0)
        const kidH = 36
        const totalH = rootH + 28 + kidH + (leafRows ? 10 + leafRows * 18 : 0) + 16
        ensure(totalH + (b.caption ? 20 : 0))

        // root
        const rootX = margin + (maxW - rootW) / 2
        box(rootX, y, rootW, rootH, p.accent, undefined, 7)
        centerText(b.root, rootX, y, rootW, rootH, 10.5, p.onAccent, true)

        const busY = y + rootH + 14
        doc.setDrawColor(...p.line)
        doc.setLineWidth(1.2)
        doc.line(rootX + rootW / 2, y + rootH, rootX + rootW / 2, busY)
        if (kids.length > 1) {
          doc.line(margin + kidW / 2, busY, margin + maxW - kidW / 2, busY)
        }

        kids.forEach((k, i) => {
          const x = margin + i * (kidW + gap)
          const cx = x + kidW / 2
          doc.setDrawColor(...p.line)
          doc.line(cx, busY, cx, busY + 14)
          box(x, busY + 14, kidW, kidH, WHITE, p.accent, 6)
          centerText(k.text, x, busY + 14, kidW, kidH, 9, p.text, true)
          // leaf items under each child
          let ly = busY + 14 + kidH + 12
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8.5)
          doc.setTextColor(...p.muted)
          ;(k.children ?? []).slice(0, 6).forEach((leaf) => {
            const ll = doc.splitTextToSize(leaf, kidW - 10) as string[]
            doc.text(ll, cx, ly, { align: "center" })
            ly += ll.length * 11 + 4
          })
        })
        y += totalH
        if (b.caption) {
          doc.setFont("helvetica", "italic")
          doc.setFontSize(9)
          doc.setTextColor(...p.muted)
          doc.text(b.caption, margin + maxW / 2, y, { align: "center" })
          y += 18
        }
        break
      }

      case "chart": {
        y = drawChart(doc, b.chart, margin, y, maxW, p, ensure)
        break
      }

      case "table": {
        ensure(70)
        autoTable(doc, {
          startY: y,
          head: [b.columns],
          body: b.rows.map((r) => r.map((c) => String(c))),
          margin: { left: margin, right: margin },
          styles: {
            font: "helvetica",
            fontSize: 9.5,
            cellPadding: 7,
            textColor: p.text,
            lineColor: p.line,
            lineWidth: 0.5,
          },
          headStyles: { fillColor: p.accent, textColor: p.onAccent, fontStyle: "bold" },
          alternateRowStyles: { fillColor: p.panel },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
        if (b.caption) {
          doc.setFont("helvetica", "italic")
          doc.setFontSize(9)
          doc.setTextColor(...p.muted)
          doc.text(b.caption, margin, y)
          y += 16
        }
        y += 6
        break
      }
    }
  }

  // ── Footers ───────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  const footerText = spec.footer ?? spec.title
  const firstNumbered = spec.cover ? 2 : 1
  for (let pg = firstNumbered; pg <= pages; pg++) {
    doc.setPage(pg)
    doc.setDrawColor(...p.line)
    doc.setLineWidth(0.5)
    doc.line(margin, pageH - 38, pageW - margin, pageH - 38)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...p.muted)
    if (footerText) doc.text(footerText, margin, pageH - 24)
    doc.text(`${pg}${spec.cover ? "" : ""} / ${pages}`, pageW - margin, pageH - 24, { align: "right" })
  }

  return new Uint8Array(doc.output("arraybuffer"))
}

// ── Charts (vector) ─────────────────────────────────────────────────────────

function seriesColors(accent: RGB): RGB[] {
  // Accent first, then a harmonious spread that stays readable in print.
  return [
    accent,
    hexToRgb("0EA5E9"),
    hexToRgb("8B5CF6"),
    hexToRgb("F59E0B"),
    hexToRgb("10B981"),
    hexToRgb("EF4444"),
  ]
}

function drawChart(
  doc: jsPDF,
  chart: PdfChartSpec,
  margin: number,
  yStart: number,
  maxW: number,
  p: Palette,
  ensure: (h: number) => void
): number {
  const H = 190
  const captionH = chart.caption ? 20 : 0
  ensure(H + captionH + 20)
  let y = yStart

  const colors = seriesColors(p.accent)
  const labels = chart.labels ?? []
  const sets = (chart.datasets ?? []).filter((d) => Array.isArray(d.data))
  if (!sets.length || !labels.length) return y

  if (chart.type === "pie" || chart.type === "donut") {
    const data = sets[0].data
    const total = data.reduce((a, b) => a + Math.max(0, b), 0) || 1
    const cx = margin + 105
    const cy = y + H / 2
    const r = 72
    let ang = -Math.PI / 2
    data.forEach((v, i) => {
      const slice = (Math.max(0, v) / total) * Math.PI * 2
      const c = colors[i % colors.length]
      doc.setFillColor(...c)
      // Approximate the slice with a triangle fan — smooth enough at print size.
      const steps = Math.max(2, Math.ceil(slice / 0.12))
      for (let s = 0; s < steps; s++) {
        const a1 = ang + (slice * s) / steps
        const a2 = ang + (slice * (s + 1)) / steps
        doc.triangle(
          cx,
          cy,
          cx + r * Math.cos(a1),
          cy + r * Math.sin(a1),
          cx + r * Math.cos(a2),
          cy + r * Math.sin(a2),
          "F"
        )
      }
      ang += slice
    })
    if (chart.type === "donut") {
      doc.setFillColor(255, 255, 255)
      doc.circle(cx, cy, r * 0.55, "F")
    }
    // legend
    let ly = y + 24
    labels.forEach((lb, i) => {
      const c = colors[i % colors.length]
      doc.setFillColor(...c)
      doc.roundedRect(margin + 210, ly - 7, 9, 9, 2, 2, "F")
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9.5)
      doc.setTextColor(...p.text)
      const pct = Math.round((Math.max(0, data[i] ?? 0) / total) * 100)
      doc.text(`${lb} — ${pct}%`, margin + 226, ly)
      ly += 17
    })
    y += H
  } else {
    // Cartesian (bar / line)
    const padL = 42
    const padB = 26
    const plotX = margin + padL
    const plotY = y + 8
    const plotW = maxW - padL - 8
    const plotH = H - padB - 8

    const all = sets.flatMap((d) => d.data)
    const maxV = Math.max(...all, 0)
    const minV = Math.min(...all, 0)
    const range = maxV - minV || 1
    const yOf = (v: number) => plotY + plotH - ((v - minV) / range) * plotH

    // gridlines + y labels
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    for (let i = 0; i <= 4; i++) {
      const v = minV + (range * i) / 4
      const gy = yOf(v)
      doc.setDrawColor(...p.line)
      doc.setLineWidth(0.5)
      doc.line(plotX, gy, plotX + plotW, gy)
      doc.setTextColor(...p.muted)
      doc.text(formatNum(v), plotX - 6, gy + 3, { align: "right" })
    }

    if (chart.type === "bar") {
      const groups = labels.length
      const groupW = plotW / groups
      const barW = Math.min(30, (groupW * 0.62) / sets.length)
      sets.forEach((d, si) => {
        const c = colors[si % colors.length]
        doc.setFillColor(...c)
        d.data.forEach((v, i) => {
          const gx = plotX + i * groupW + groupW / 2
          const totalW = barW * sets.length
          const bx = gx - totalW / 2 + si * barW
          const top = yOf(Math.max(v, minV))
          const base = yOf(Math.max(0, minV))
          doc.roundedRect(bx, Math.min(top, base), barW - 2, Math.abs(base - top) || 1, 2, 2, "F")
        })
      })
    } else {
      sets.forEach((d, si) => {
        const c = colors[si % colors.length]
        doc.setDrawColor(...c)
        doc.setLineWidth(1.8)
        const stepX = labels.length <= 1 ? 0 : plotW / (labels.length - 1)
        for (let i = 0; i < d.data.length - 1; i++) {
          doc.line(plotX + i * stepX, yOf(d.data[i]), plotX + (i + 1) * stepX, yOf(d.data[i + 1]))
        }
        doc.setFillColor(...c)
        d.data.forEach((v, i) => doc.circle(plotX + i * stepX, yOf(v), 2.4, "F"))
      })
    }

    // x labels
    doc.setFontSize(8)
    doc.setTextColor(...p.muted)
    labels.forEach((lb, i) => {
      const gx =
        chart.type === "bar"
          ? plotX + (i + 0.5) * (plotW / labels.length)
          : plotX + i * (labels.length <= 1 ? 0 : plotW / (labels.length - 1))
      const short = lb.length > 12 ? lb.slice(0, 11) + "…" : lb
      doc.text(short, gx, plotY + plotH + 14, { align: "center" })
    })

    // series legend (only when more than one)
    if (sets.length > 1) {
      let lx = plotX
      const ly = plotY + plotH + 26
      sets.forEach((d, si) => {
        const c = colors[si % colors.length]
        doc.setFillColor(...c)
        doc.roundedRect(lx, ly - 6, 8, 8, 2, 2, "F")
        doc.setFontSize(8.5)
        doc.setTextColor(...p.text)
        const nm = d.label ?? `Series ${si + 1}`
        doc.text(nm, lx + 12, ly)
        lx += 12 + doc.getTextWidth(nm) + 18
      })
      y += 12
    }
    y += H
  }

  if (chart.caption) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9)
    doc.setTextColor(...p.muted)
    doc.text(chart.caption, margin + maxW / 2, y + 6, { align: "center" })
    y += 20
  }
  return y + 12
}

function formatNum(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
