"use client"

import { useEffect, useRef, useState } from "react"

let mermaidInitialized = false

// Best-effort cleanup of the most common LLM mistakes that break Mermaid.
function sanitize(input: string): string {
  let s = input.trim()

  // Strip an accidental ```mermaid fence if the model included one.
  s = s.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/i, "")

  // Normalise smart quotes to straight quotes.
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')

  // Remove a leading "mermaid" word if present on its own line.
  s = s.replace(/^mermaid\s*\n/i, "")

  // --- Repair common invalid arrow forms the model produces ---
  // Invalid labeled arrows like  -->|label|>  or  --|label|>  →  -->|label|
  s = s.replace(/(--+|==+|-\.+-?)>?\s*\|([^|]*)\|\s*>/g, "-->|$2|")
  // Stray "|>" after a label anywhere →  "|"
  s = s.replace(/\|\s*>/g, "|")
  // Arrowhead written as "|> B" (no label) →  "--> B"
  s = s.replace(/(--+|==+)\s*>?\s*>\s*/g, "$1> ")
  // Collapse accidental double arrowheads  -->>  (only valid in sequenceDiagram)
  if (!/^\s*sequenceDiagram/m.test(s)) {
    s = s.replace(/-->>/g, "-->")
  }

  return s.trim()
}

export function MermaidDiagram({
  chart,
  streaming = false,
}: {
  chart: string
  streaming?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    // Don't try to render an incomplete diagram while it's still streaming.
    if (streaming) return

    let cancelled = false

    const render = async () => {
      const code = sanitize(chart)
      if (!code) return

      try {
        const mermaid = (await import("mermaid")).default
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "loose",
            flowchart: { curve: "basis", htmlLabels: true },
            themeVariables: {
              background: "#0a0a0a",
              primaryColor: "#161616",
              primaryTextColor: "#f2f2f3",
              primaryBorderColor: "#3a3a3a",
              secondaryColor: "#1f1f1f",
              tertiaryColor: "#141414",
              lineColor: "#7a7a7a",
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: "14px",
            },
          })
          mermaidInitialized = true
        }

        // Validate first — throws on bad syntax without touching the DOM.
        await mermaid.parse(code)

        const { svg } = await mermaid.render(idRef.current, code)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render diagram")
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [chart, streaming])

  // While streaming, show a calm placeholder instead of error spam.
  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Drawing diagram…
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-xs text-muted-foreground">Diagram source</p>
        <pre className="overflow-x-auto text-xs text-foreground/80">
          <code>{sanitize(chart)}</code>
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="my-4 flex justify-center overflow-x-auto rounded-xl border border-border bg-[#0a0a0a] p-5 [&_svg]:h-auto [&_svg]:max-w-full"
    />
  )
}
