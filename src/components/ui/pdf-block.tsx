"use client"

import { useState } from "react"
import { Download, FileText, Loader2 } from "lucide-react"
import { normalizePdfBlocks, type PdfSpec, type PdfBlockSpec, type PdfChartSpec } from "@/lib/pdf"

export type { PdfSpec } from "@/lib/pdf"

export function parsePdf(code: string): PdfSpec | null {
  try {
    const o = JSON.parse(code.trim())
    if (!o || !Array.isArray(o.blocks)) return null
    // Model output is untrusted — coerce every field to the expected shape so a
    // stray object in a text field can't crash the React preview.
    return { ...o, blocks: normalizePdfBlocks(o.blocks) } as PdfSpec
  } catch {
    return null
  }
}

// Same theme surface colors the real renderer uses, so the preview matches the file.
const THEME_BG: Record<string, string> = {
  light: "#ffffff",
  slate: "#ffffff",
  warm: "#faf8f5",
  mono: "#ffffff",
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
  // Normalize either source — a server-provided spec is still model-authored.
  const spec = specProp
    ? ({ ...specProp, blocks: normalizePdfBlocks(specProp.blocks) } as PdfSpec)
    : code
      ? parsePdf(code)
      : null

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
  const paper = THEME_BG[spec.theme ?? "light"] ?? "#ffffff"

  // Build the real PDF with the SAME renderer the server uses, so what the user
  // downloads is byte-for-byte the document they previewed.
  const download = async () => {
    setBusy(true)
    try {
      const { renderPdf } = await import("@/lib/pdf")
      const bytes = renderPdf(spec)
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(spec.title ?? "document").replace(/[^\w]+/g, "_")}.pdf`
      a.click()
      URL.revokeObjectURL(url)
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
      <div
        className="max-h-96 overflow-y-auto rounded-lg px-7 py-6 text-black"
        style={{ background: paper }}
      >
        {spec.title && (
          <>
            {spec.eyebrow && (
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {spec.eyebrow}
              </p>
            )}
            <div className="mb-2 h-1 w-9 rounded-full" style={{ background: `#${accentHex}` }} />
            <h1 className="text-lg font-bold">{spec.title}</h1>
            {spec.subtitle && <p className="mt-0.5 text-xs text-zinc-500">{spec.subtitle}</p>}
            <hr className="my-3 border-zinc-200" />
          </>
        )}
        {spec.blocks.map((b, i) => (
          <BlockPreview key={i} block={b} accent={accentHex} />
        ))}
      </div>
    </div>
  )
}

// ── Per-block preview ───────────────────────────────────────────────────────

function BlockPreview({ block: b, accent }: { block: PdfBlockSpec; accent: string }) {
  const tone: Record<string, string> = {
    info: "#2563EB",
    success: "#16A34A",
    warn: "#D97706",
    danger: "#DC2626",
  }

  switch (b.type) {
    case "heading":
      return (
        <h2
          className={`mb-1.5 mt-3 font-semibold ${
            b.level === 3 ? "text-[10px] uppercase tracking-wide text-zinc-500" : b.level === 2 ? "text-xs text-zinc-800" : "text-sm"
          }`}
          style={b.level === 1 ? { color: `#${accent}` } : undefined}
        >
          {b.text}
        </h2>
      )

    case "paragraph":
      return <p className="mb-2 text-xs leading-relaxed text-zinc-700">{b.text}</p>

    case "list":
      return (
        <ul className={`mb-2 space-y-0.5 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}>
          {b.items.map((it, j) => (
            <li key={j} className="text-xs leading-relaxed text-zinc-700">
              {it}
            </li>
          ))}
        </ul>
      )

    case "callout": {
      const c = tone[b.tone ?? "info"]
      return (
        <div className="my-2 rounded border-l-2 px-3 py-2 text-xs text-zinc-700" style={{ borderColor: c, background: `${c}0f` }}>
          {b.title && <span className="mb-0.5 block font-semibold" style={{ color: c }}>{b.title}</span>}
          {b.text}
        </div>
      )
    }

    case "divider":
      return <hr className="my-3 border-zinc-200" />

    case "quote":
      return (
        <blockquote className="my-2 border-l-2 pl-3 text-xs italic text-zinc-700" style={{ borderColor: `#${accent}` }}>
          {b.text}
          {b.attribution && <footer className="mt-1 not-italic text-[10px] text-zinc-500">— {b.attribution}</footer>}
        </blockquote>
      )

    case "stats":
      return (
        <div className="my-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(b.items.length, 4)}, minmax(0,1fr))` }}>
          {b.items.slice(0, 4).map((s, j) => (
            <div key={j} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2 text-center">
              <div className="text-sm font-bold" style={{ color: `#${accent}` }}>{s.value}</div>
              <div className="text-[9px] leading-tight text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      )

    case "columns":
      return (
        <div className="my-2 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(b.columns.length, 3)}, minmax(0,1fr))` }}>
          {b.columns.slice(0, 3).map((c, j) => (
            <div key={j}>
              {c.heading && <div className="mb-1 text-[11px] font-semibold" style={{ color: `#${accent}` }}>{c.heading}</div>}
              {c.text && <p className="text-[11px] leading-relaxed text-zinc-700">{c.text}</p>}
              {c.bullets && (
                <ul className="list-disc space-y-0.5 pl-4">
                  {c.bullets.map((t, k) => (
                    <li key={k} className="text-[11px] leading-relaxed text-zinc-700">{t}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )

    case "steps":
      return (
        <div className="my-2 space-y-2">
          {b.items.map((s, j) => (
            <div key={j} className="flex gap-2">
              <span
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ background: `#${accent}` }}
              >
                {j + 1}
              </span>
              <div>
                <div className="text-[11px] font-semibold text-zinc-800">{s.title}</div>
                {s.text && <div className="text-[10px] leading-relaxed text-zinc-600">{s.text}</div>}
              </div>
            </div>
          ))}
        </div>
      )

    case "timeline":
      return (
        <div className="my-2 space-y-2">
          {b.items.map((t, j) => (
            <div key={j} className="flex gap-2">
              <span className="w-10 shrink-0 text-right text-[9px] font-semibold text-zinc-500">{t.date}</span>
              <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: `#${accent}` }} />
              <div>
                <div className="text-[11px] font-semibold text-zinc-800">{t.title}</div>
                {t.text && <div className="text-[10px] leading-relaxed text-zinc-600">{t.text}</div>}
              </div>
            </div>
          ))}
        </div>
      )

    case "comparison":
      return (
        <div className="my-2 grid grid-cols-2 gap-2">
          {[b.left, b.right].map((s, j) => (
            <div key={j} className="overflow-hidden rounded border border-zinc-200">
              <div
                className="px-2 py-1 text-[10px] font-semibold text-white"
                style={{ background: j === 0 ? "#64748B" : `#${accent}` }}
              >
                {s.heading}
              </div>
              <ul className="space-y-0.5 px-2 py-1.5">
                {s.items.map((it, k) => (
                  <li key={k} className="text-[10px] leading-relaxed text-zinc-700">
                    <span style={{ color: j === 0 ? "#64748B" : `#${accent}` }}>{j === 0 ? "– " : "+ "}</span>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )

    case "flowchart":
      return (
        <div className="my-2 rounded border border-zinc-200 bg-zinc-50 p-3">
          <div className={b.direction === "horizontal" ? "flex flex-wrap items-center gap-1.5" : "space-y-1.5"}>
            {b.nodes.map((n, j) => (
              <div key={n.id} className={b.direction === "horizontal" ? "" : "flex flex-col items-center"}>
                <div
                  className="px-2.5 py-1 text-center text-[10px] font-medium text-zinc-800"
                  style={{
                    border: `1px solid #${accent}`,
                    background: n.kind === "terminator" ? `#${accent}` : "#fff",
                    color: n.kind === "terminator" ? "#fff" : undefined,
                    borderRadius: n.kind === "terminator" ? 999 : n.kind === "decision" ? 2 : 4,
                    transform: n.kind === "decision" ? "skewX(-8deg)" : undefined,
                  }}
                >
                  {n.text}
                </div>
                {b.direction !== "horizontal" && j < b.nodes.length - 1 && (
                  <span className="text-[10px] leading-none text-zinc-400">↓</span>
                )}
              </div>
            ))}
          </div>
          {b.caption && <p className="mt-2 text-center text-[9px] italic text-zinc-500">{b.caption}</p>}
        </div>
      )

    case "tree":
      return (
        <div className="my-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-center">
          <div
            className="mx-auto mb-1.5 inline-block rounded px-3 py-1 text-[10px] font-semibold text-white"
            style={{ background: `#${accent}` }}
          >
            {b.root}
          </div>
          <div className="flex justify-center gap-2">
            {b.children.slice(0, 5).map((c, j) => (
              <div key={j} className="flex-1">
                <div className="rounded border bg-white px-1.5 py-1 text-[9px] font-medium text-zinc-800" style={{ borderColor: `#${accent}` }}>
                  {c.text}
                </div>
                {c.children?.slice(0, 4).map((leaf, k) => (
                  <div key={k} className="mt-0.5 text-[8px] text-zinc-500">{leaf}</div>
                ))}
              </div>
            ))}
          </div>
          {b.caption && <p className="mt-2 text-[9px] italic text-zinc-500">{b.caption}</p>}
        </div>
      )

    case "chart":
      return <ChartPreview chart={b.chart} accent={accent} />

    case "pagebreak":
      return <div className="my-3 border-t border-dashed border-zinc-300 text-center text-[8px] text-zinc-400">page break</div>

    case "table":
      return (
        <div className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                {b.columns.map((c, j) => (
                  <th
                    key={j}
                    className="border border-zinc-200 px-2 py-1 text-left font-semibold text-white"
                    style={{ background: `#${accent}` }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.slice(0, 12).map((r, j) => (
                <tr key={j} className={j % 2 ? "bg-zinc-50" : ""}>
                  {r.map((c, k) => (
                    <td key={k} className="border border-zinc-200 px-2 py-1 text-zinc-700">
                      {String(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {b.caption && <p className="mt-1 text-[9px] italic text-zinc-500">{b.caption}</p>}
        </div>
      )

    default:
      return null
  }
}

// Lightweight SVG chart preview (the real PDF draws its own vectors).
function ChartPreview({ chart, accent }: { chart: PdfChartSpec; accent: string }) {
  const palette = [`#${accent}`, "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444"]
  const sets = chart.datasets ?? []
  const labels = chart.labels ?? []
  if (!sets.length || !labels.length) return null

  const W = 320
  const H = 110

  if (chart.type === "pie" || chart.type === "donut") {
    const data = sets[0].data
    const total = data.reduce((a, b) => a + Math.max(0, b), 0) || 1
    let ang = -Math.PI / 2
    const r = 44
    const cx = 52
    const cy = H / 2
    const arcs = data.map((v, i) => {
      const slice = (Math.max(0, v) / total) * Math.PI * 2
      const x1 = cx + r * Math.cos(ang)
      const y1 = cy + r * Math.sin(ang)
      ang += slice
      const x2 = cx + r * Math.cos(ang)
      const y2 = cy + r * Math.sin(ang)
      const large = slice > Math.PI ? 1 : 0
      return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, c: palette[i % palette.length] }
    })
    return (
      <div className="my-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {arcs.map((a, i) => <path key={i} d={a.d} fill={a.c} />)}
          {chart.type === "donut" && <circle cx={cx} cy={cy} r={r * 0.55} fill="#fff" />}
          {labels.slice(0, 5).map((lb, i) => (
            <g key={i}>
              <rect x={116} y={18 + i * 16} width={8} height={8} rx={2} fill={palette[i % palette.length]} />
              <text x={130} y={26 + i * 16} fontSize={9} fill="#3f3f46">
                {lb} — {Math.round((Math.max(0, sets[0].data[i] ?? 0) / total) * 100)}%
              </text>
            </g>
          ))}
        </svg>
        {chart.caption && <p className="text-center text-[9px] italic text-zinc-500">{chart.caption}</p>}
      </div>
    )
  }

  const all = sets.flatMap((d) => d.data)
  const maxV = Math.max(...all, 0)
  const minV = Math.min(...all, 0)
  const range = maxV - minV || 1
  const padL = 6
  const plotH = H - 22
  const yOf = (v: number) => plotH - ((v - minV) / range) * plotH + 6

  return (
    <div className="my-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={padL} y1={6 + (plotH / 3) * i} x2={W - 6} y2={6 + (plotH / 3) * i} stroke="#e4e4e7" strokeWidth={0.6} />
        ))}
        {chart.type === "bar"
          ? sets.map((d, si) =>
              d.data.map((v, i) => {
                const gw = (W - padL - 6) / labels.length
                const bw = Math.min(14, (gw * 0.6) / sets.length)
                const x = padL + i * gw + gw / 2 - (bw * sets.length) / 2 + si * bw
                const top = yOf(v)
                const base = yOf(Math.max(0, minV))
                return <rect key={`${si}-${i}`} x={x} y={Math.min(top, base)} width={bw - 1.5} height={Math.abs(base - top) || 1} rx={1.5} fill={palette[si % palette.length]} />
              })
            )
          : sets.map((d, si) => {
              const step = labels.length <= 1 ? 0 : (W - padL - 6) / (labels.length - 1)
              const pts = d.data.map((v, i) => `${padL + i * step},${yOf(v)}`).join(" ")
              return <polyline key={si} points={pts} fill="none" stroke={palette[si % palette.length]} strokeWidth={1.6} />
            })}
        {labels.slice(0, 8).map((lb, i) => {
          const gw = (W - padL - 6) / labels.length
          const x = chart.type === "bar" ? padL + (i + 0.5) * gw : padL + i * (labels.length <= 1 ? 0 : (W - padL - 6) / (labels.length - 1))
          return (
            <text key={i} x={x} y={H - 4} fontSize={8} fill="#71717a" textAnchor="middle">
              {lb.length > 8 ? lb.slice(0, 7) + "…" : lb}
            </text>
          )
        })}
      </svg>
      {chart.caption && <p className="text-center text-[9px] italic text-zinc-500">{chart.caption}</p>}
    </div>
  )
}
