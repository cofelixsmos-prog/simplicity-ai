"use client"

import { X } from "lucide-react"
import type { Visual } from "@/components/ui/message-content"
import { MermaidDiagram } from "@/components/ui/mermaid-diagram"
import { SvgDiagram } from "@/components/ui/svg-diagram"
import { ThreeDiagram } from "@/components/ui/three-diagram"
import { ChartBlock } from "@/components/ui/chart-block"
import { PptBlock } from "@/components/ui/ppt-block"
import { PdfBlock } from "@/components/ui/pdf-block"
import { ExcelBlock } from "@/components/ui/excel-block"

const LABELS: Record<Visual["kind"], string> = {
  mermaid: "Flowchart",
  svg: "2D Illustration",
  threejs: "3D Model",
  chart: "Chart",
  ppt: "Presentation",
  pdf: "Document",
  excel: "Spreadsheet",
}

export function VisualPanel({
  visual,
  onClose,
}: {
  visual: Visual
  onClose: () => void
}) {
  return (
    <aside className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {LABELS[visual.kind]}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
            {visual.kind}
          </span>
        </div>
        <button
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Close panel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="[&>div]:my-0">
          {visual.kind === "mermaid" && <MermaidDiagram chart={visual.code} />}
          {visual.kind === "svg" && <SvgDiagram code={visual.code} />}
          {visual.kind === "chart" && <ChartBlock code={visual.code} />}
          {visual.kind === "ppt" && <PptBlock code={visual.code} compact />}
          {visual.kind === "pdf" && <PdfBlock code={visual.code} />}
          {visual.kind === "excel" && <ExcelBlock code={visual.code} compact />}
          {visual.kind === "threejs" && <ThreeDiagram code={visual.code} />}
        </div>
      </div>
    </aside>
  )
}
