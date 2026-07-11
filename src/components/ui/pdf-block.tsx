"use client"

import { useState } from "react"
import { Download, FileText, Loader2 } from "lucide-react"

type Block =
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
  blocks: Block[]
}

export function parsePdf(code: string): PdfSpec | null {
  try {
    const o = JSON.parse(code.trim())
    if (!o || !Array.isArray(o.blocks)) return null
    return o as PdfSpec
  } catch {
    return null
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function PdfBlock({
  code,
  streaming = false,
  spec: specProp,
  downloadUrl,
  downloadName,
}: {
  code?: string
  streaming?: boolean
  // When the PDF was generated server-side (create_pdf), pass the spec + a
  // real download URL directly instead of parsing `code` and regenerating
  // client-side — same visual, but the download is the actual stored file.
  spec?: PdfSpec
  downloadUrl?: string
  downloadName?: string
}) {
  const [busy, setBusy] = useState(false)
  const spec = specProp ?? (code ? parsePdf(code) : null)

  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Designing document…
      </div>
    )
  }
  if (!spec) return null

  const accentHex = (spec.accent ?? "2563EB").replace("#", "")
  const accent = hexToRgb(accentHex)
  const text = hexToRgb("0F172A")
  const muted = hexToRgb("64748B")
  const line = hexToRgb("E2E8F0")
  const panel = hexToRgb("F1F5F9")

  const download = async () => {
    setBusy(true)
    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default
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

      // ── Title block (cover-style header) ──
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

      for (const b of spec.blocks) {
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

      // ── Footer: title + page numbers on every page ──
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(...muted)
        if (spec.title) doc.text(spec.title, margin, pageH - 24)
        doc.text(`${p} / ${pages}`, pageW - margin, pageH - 24, { align: "right" })
      }

      doc.save(`${(spec.title ?? "document").replace(/[^\w]+/g, "_")}.pdf`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="my-4 rounded-xl border border-border bg-[#0b0b0c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-white/70" />
          <span className="text-sm font-medium text-white">{spec.title ?? "Document"}</span>
        </div>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download={downloadName}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-all hover:scale-[1.02]"
          >
            <Download className="size-3.5" />
            .pdf
          </a>
        ) : (
          <button
            onClick={download}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            .pdf
          </button>
        )}
      </div>

      {/* paper-like preview */}
      <div className="max-h-96 overflow-y-auto rounded-lg bg-white px-7 py-6 text-black">
        {spec.title && (
          <>
            <div className="mb-2 h-1 w-9 rounded-full" style={{ background: `#${accentHex}` }} />
            <h1 className="text-lg font-bold">{spec.title}</h1>
            {spec.subtitle && <p className="mt-0.5 text-xs text-zinc-500">{spec.subtitle}</p>}
            <hr className="my-3 border-zinc-200" />
          </>
        )}
        {spec.blocks.map((b, i) => {
          if (b.type === "heading")
            return (
              <h2
                key={i}
                className={`mb-1.5 mt-3 font-semibold ${b.level === 2 ? "text-xs text-zinc-800" : "text-sm"}`}
                style={b.level === 2 ? undefined : { color: `#${accentHex}` }}
              >
                {b.text}
              </h2>
            )
          if (b.type === "paragraph")
            return <p key={i} className="mb-2 text-xs leading-relaxed text-zinc-700">{b.text}</p>
          if (b.type === "list")
            return (
              <ul key={i} className={`mb-2 space-y-0.5 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}>
                {b.items.map((it, j) => (
                  <li key={j} className="text-xs leading-relaxed text-zinc-700">{it}</li>
                ))}
              </ul>
            )
          if (b.type === "callout")
            return (
              <div key={i} className="my-2 border-l-2 bg-zinc-50 px-3 py-2 text-xs text-zinc-700" style={{ borderColor: `#${accentHex}` }}>
                {b.text}
              </div>
            )
          if (b.type === "divider") return <hr key={i} className="my-3 border-zinc-200" />
          if (b.type === "table")
            return (
              <div key={i} className="my-2 overflow-x-auto">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr>
                      {b.columns.map((c, j) => (
                        <th key={j} className="border border-zinc-200 px-2 py-1 text-left font-semibold text-white" style={{ background: `#${accentHex}` }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.slice(0, 12).map((r, j) => (
                      <tr key={j} className={j % 2 ? "bg-zinc-50" : ""}>
                        {r.map((c, k) => (
                          <td key={k} className="border border-zinc-200 px-2 py-1 text-zinc-700">{String(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          return null
        })}
      </div>
    </div>
  )
}
