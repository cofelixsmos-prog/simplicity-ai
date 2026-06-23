"use client"

// Renders model-authored SVG safely: strips scripts, event handlers,
// external refs, and anything that could execute.
function sanitizeSvg(raw: string): string {
  let s = raw.trim()
  // Pull out just the <svg>…</svg> if there's surrounding text.
  const match = s.match(/<svg[\s\S]*<\/svg>/i)
  if (match) s = match[0]

  // Remove <script> blocks.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "")
  // Remove inline event handlers (onclick, onload, etc.).
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  // Remove javascript: URLs.
  s = s.replace(/(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "")
  // Remove <foreignObject> (can embed arbitrary HTML).
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
  return s
}

export function SvgDiagram({
  code,
  streaming = false,
}: {
  code: string
  streaming?: boolean
}) {
  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Drawing illustration…
      </div>
    )
  }

  const safe = sanitizeSvg(code)
  if (!safe.includes("<svg")) {
    return (
      <div className="my-4 rounded-xl border border-border bg-card p-4">
        <pre className="overflow-x-auto text-xs text-foreground/70">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div
      className="my-4 w-full overflow-hidden rounded-xl border border-border bg-[#0b0b0c] p-3 [&_svg]:h-auto [&_svg]:w-full"
      // sanitized above; no scripts/handlers can survive
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
