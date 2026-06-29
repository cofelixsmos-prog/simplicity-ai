"use client"

import { useState } from "react"
import { Download, Table2, Loader2 } from "lucide-react"

type ExcelColumn = string | { header: string; width?: number; numFmt?: string }
interface ExcelSheet {
  name?: string
  columns: ExcelColumn[]
  rows: (string | number)[][]
}
export interface ExcelSpec {
  title?: string
  accent?: string
  sheets: ExcelSheet[]
}

export function parseExcel(code: string): ExcelSpec | null {
  try {
    const o = JSON.parse(code.trim())
    if (!o || !Array.isArray(o.sheets)) return null
    return o as ExcelSpec
  } catch {
    return null
  }
}

const headerOf = (c: ExcelColumn) => (typeof c === "string" ? c : c.header)

export function ExcelBlock({
  code,
  streaming = false,
  compact = false,
}: {
  code: string
  streaming?: boolean
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState(0)
  const spec = parseExcel(code)

  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Building spreadsheet…
      </div>
    )
  }
  if (!spec || spec.sheets.length === 0) return null

  const accentHex = (spec.accent ?? "059669").replace("#", "")
  const active = spec.sheets[Math.min(tab, spec.sheets.length - 1)]

  const download = async () => {
    setBusy(true)
    try {
      const mod = await import("exceljs")
      const ExcelJS = (mod as unknown as { default?: typeof import("exceljs") }).default ?? mod
      const wb = new ExcelJS.Workbook()
      wb.creator = "Simplicity"

      const thin = { style: "thin" as const, color: { argb: "FFE2E8F0" } }
      spec.sheets.forEach((s, si) => {
        const ws = wb.addWorksheet((s.name || `Sheet${si + 1}`).slice(0, 31))
        const cols = s.columns.map((c) => (typeof c === "string" ? { header: c } : c))

        ws.columns = cols.map((c, ci) => {
          let max = (c.header ?? "").length
          for (const r of s.rows.slice(0, 300)) max = Math.max(max, String(r[ci] ?? "").length)
          return {
            header: c.header,
            width: c.width ?? Math.min(48, Math.max(12, max + 3)),
            style: c.numFmt ? { numFmt: c.numFmt } : undefined,
          }
        })

        const header = ws.getRow(1)
        header.font = { bold: true, color: { argb: "FFFFFFFF" } }
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + accentHex } }
        header.alignment = { vertical: "middle" }
        header.height = 20

        s.rows.forEach((r, i) => {
          const row = ws.addRow(r)
          if (i % 2 === 1)
            row.eachCell({ includeEmpty: true }, (cell) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }
            })
        })

        ws.eachRow((row) =>
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: thin, bottom: thin, left: thin, right: thin }
          })
        )

        ws.views = [{ state: "frozen", ySplit: 1 }]
        if (cols.length > 0)
          ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(spec.title ?? "spreadsheet").replace(/[^\w]+/g, "_")}.xlsx`
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
          <Table2 className="size-4 text-white/70" />
          <span className="text-sm font-medium text-white">{spec.title ?? "Spreadsheet"}</span>
          <span className="text-xs text-white/40">· {spec.sheets.length} sheet{spec.sheets.length === 1 ? "" : "s"}</span>
        </div>
        <button
          onClick={download}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          .xlsx
        </button>
      </div>

      {/* sheet tabs */}
      {spec.sheets.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {spec.sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                i === tab ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/10"
              }`}
            >
              {s.name || `Sheet${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* table preview */}
      <div className={`overflow-auto rounded-lg bg-white ${compact ? "max-h-[60vh]" : "max-h-96"}`}>
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0">
            <tr>
              {active.columns.map((c, j) => (
                <th
                  key={j}
                  className="border border-zinc-200 px-2.5 py-1.5 text-left font-semibold text-white"
                  style={{ background: `#${accentHex}` }}
                >
                  {headerOf(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.rows.slice(0, compact ? 200 : 30).map((r, j) => (
              <tr key={j} className={j % 2 ? "bg-zinc-50" : "bg-white"}>
                {r.map((c, k) => (
                  <td key={k} className="whitespace-nowrap border border-zinc-200 px-2.5 py-1 text-zinc-700">
                    {String(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
