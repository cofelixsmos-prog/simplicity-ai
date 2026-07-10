// Server-side PDF rendering from the same spec the inline PdfBlock uses, so the
// AI can produce a real PDF file (to attach to email, save to Drive, or offer as
// a download) — not just a client-only preview. jsPDF runs fine in Node.
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export type PdfBlockSpec =
  | { type: "heading"; text: string; level?: 1 | 2 }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; columns: string[]; rows: (string | number)[][] }
  | { type: "callout"; text: string }
  | { type: "divider" }

export interface PdfSpec {
  title?: string
  subtitle?: string
  accent?: string
  blocks: PdfBlockSpec[]
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Render the spec to PDF bytes.
export function renderPdf(spec: PdfSpec): Buffer {
  const accent = hexToRgb((spec.accent ?? "2563EB").replace("#", ""))
  const text = hexToRgb("0F172A")
  const muted = hexToRgb("64748B")
  const line = hexToRgb("E2E8F0")
  const panel = hexToRgb("F1F5F9")

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 56
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - margin * 2
  let y = margin

  const ensure = (h: number) => {
    if (y + h > pageH - margin - 24) {
      doc.addPage()
      y = margin
    }
  }

  if (spec.title) {
    doc.setFillColor(...accent)
    doc.rect(margin, y, 38, 5, "F")
    y += 20
    doc.setFont("helvetica", "bold")
    doc.setFontSize(24)
    doc.setTextColor(...text)
    const lines = doc.splitTextToSize(spec.title, maxW)
    doc.text(lines, margin, y)
    y += lines.length * 26
    if (spec.subtitle) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(12)
      doc.setTextColor(...muted)
      const sub = doc.splitTextToSize(spec.subtitle, maxW)
      y += 6
      doc.text(sub, margin, y)
      y += sub.length * 16
    }
    y += 10
    doc.setDrawColor(...line)
    doc.setLineWidth(1)
    doc.line(margin, y, pageW - margin, y)
    y += 22
  }

  for (const b of spec.blocks ?? []) {
    if (b.type === "heading") {
      const lvl = b.level ?? 1
      doc.setFont("helvetica", "bold")
      doc.setFontSize(lvl === 1 ? 15 : 13)
      const lines = doc.splitTextToSize(b.text, maxW - 12)
      ensure(lines.length * 20 + 14)
      y += 12
      if (lvl === 1) {
        doc.setFillColor(...accent)
        doc.rect(margin, y - 9, 4, 13, "F")
        doc.setTextColor(...accent)
      } else {
        doc.setTextColor(...text)
      }
      doc.text(lines, margin + (lvl === 1 ? 12 : 0), y)
      y += lines.length * 20
    } else if (b.type === "paragraph") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.setTextColor(...text)
      const lines = doc.splitTextToSize(b.text, maxW)
      ensure(lines.length * 16)
      doc.text(lines, margin, y, { lineHeightFactor: 1.45 })
      y += lines.length * 16 + 8
    } else if (b.type === "list") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.setTextColor(...text)
      b.items.forEach((it, i) => {
        const marker = b.ordered ? `${i + 1}.` : "•"
        const lines = doc.splitTextToSize(it, maxW - 22)
        ensure(lines.length * 16 + 2)
        doc.setTextColor(...accent)
        doc.text(marker, margin + 4, y)
        doc.setTextColor(...text)
        doc.text(lines, margin + 22, y)
        y += lines.length * 16 + 3
      })
      y += 8
    } else if (b.type === "callout") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      const lines = doc.splitTextToSize(b.text, maxW - 28)
      const h = lines.length * 16 + 20
      ensure(h)
      doc.setFillColor(...panel)
      doc.rect(margin, y - 6, maxW, h, "F")
      doc.setFillColor(...accent)
      doc.rect(margin, y - 6, 4, h, "F")
      doc.setTextColor(...text)
      doc.text(lines, margin + 16, y + 8, { lineHeightFactor: 1.4 })
      y += h + 8
    } else if (b.type === "divider") {
      ensure(16)
      doc.setDrawColor(...line)
      doc.setLineWidth(1)
      doc.line(margin, y, pageW - margin, y)
      y += 16
    } else if (b.type === "table") {
      ensure(60)
      autoTable(doc, {
        startY: y,
        head: [b.columns],
        body: b.rows.map((r) => r.map((c) => String(c))),
        margin: { left: margin, right: margin },
        styles: { font: "helvetica", fontSize: 10, cellPadding: 6, textColor: text, lineColor: line, lineWidth: 0.5 },
        headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: panel },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16
    }
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    if (spec.title) doc.text(spec.title, margin, pageH - 24)
    doc.text(`${p} / ${pages}`, pageW - margin, pageH - 24, { align: "right" })
  }

  return Buffer.from(doc.output("arraybuffer"))
}
