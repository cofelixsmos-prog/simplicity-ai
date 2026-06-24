"use client"

import { useState } from "react"
import { Download, FileText, Loader2 } from "lucide-react"

interface Block {
  type: "heading" | "paragraph" | "list"
  text?: string
  items?: string[]
}
export interface PdfSpec {
  title?: string
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

export function PdfBlock({
  code,
  streaming = false,
}: {
  code: string
  streaming?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const spec = parsePdf(code)

  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Building document…
      </div>
    )
  }
  if (!spec) return null

  const download = async () => {
    setBusy(true)
    try {
      const { jsPDF } = await import("jspdf")
      const doc = new jsPDF({ unit: "pt", format: "a4" })
      const margin = 56
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const maxW = pageW - margin * 2
      let y = margin

      const ensure = (h: number) => {
        if (y + h > pageH - margin) {
          doc.addPage()
          y = margin
        }
      }

      if (spec.title) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(22)
        const lines = doc.splitTextToSize(spec.title, maxW)
        ensure(lines.length * 26)
        doc.text(lines, margin, y)
        y += lines.length * 26 + 10
      }

      spec.blocks.forEach((b) => {
        if (b.type === "heading" && b.text) {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(15)
          const lines = doc.splitTextToSize(b.text, maxW)
          ensure(lines.length * 20 + 8)
          y += 8
          doc.text(lines, margin, y)
          y += lines.length * 20
        } else if (b.type === "paragraph" && b.text) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(11)
          const lines = doc.splitTextToSize(b.text, maxW)
          ensure(lines.length * 16)
          doc.text(lines, margin, y)
          y += lines.length * 16 + 6
        } else if (b.type === "list" && b.items) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(11)
          b.items.forEach((it) => {
            const lines = doc.splitTextToSize(`•  ${it}`, maxW - 14)
            ensure(lines.length * 16)
            doc.text(lines, margin + 8, y)
            y += lines.length * 16 + 2
          })
          y += 6
        }
      })

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
        <button
          onClick={download}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          .pdf
        </button>
      </div>
      {/* paper-like preview */}
      <div className="max-h-80 overflow-y-auto rounded-lg bg-white px-7 py-6 text-black">
        {spec.title && <h1 className="mb-3 text-lg font-bold">{spec.title}</h1>}
        {spec.blocks.map((b, i) => {
          if (b.type === "heading")
            return <h2 key={i} className="mb-1.5 mt-3 text-sm font-semibold">{b.text}</h2>
          if (b.type === "paragraph")
            return <p key={i} className="mb-2 text-xs leading-relaxed text-zinc-700">{b.text}</p>
          if (b.type === "list")
            return (
              <ul key={i} className="mb-2 list-disc space-y-0.5 pl-5">
                {b.items?.map((it, j) => (
                  <li key={j} className="text-xs leading-relaxed text-zinc-700">{it}</li>
                ))}
              </ul>
            )
          return null
        })}
      </div>
    </div>
  )
}
