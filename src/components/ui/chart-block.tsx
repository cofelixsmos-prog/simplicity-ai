"use client"

// Renders a model-authored `chart` JSON block as a clean SVG chart.
// No chart library — self-contained, monochrome to match the app.

interface Dataset {
  label?: string
  data: number[]
}
interface ChartSpec {
  type: "bar" | "line" | "pie"
  title?: string
  xLabel?: string
  yLabel?: string
  labels: string[]
  datasets: Dataset[]
}

// Grayscale series shades so multiple datasets stay distinguishable.
const SHADES = ["#f4f4f5", "#a1a1aa", "#71717a", "#52525b", "#d4d4d8"]

function parse(code: string): ChartSpec | null {
  try {
    const obj = JSON.parse(code.trim())
    if (!obj || !Array.isArray(obj.labels) || !Array.isArray(obj.datasets))
      return null
    return obj as ChartSpec
  } catch {
    return null
  }
}

export function ChartBlock({
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
        Plotting chart…
      </div>
    )
  }

  const spec = parse(code)
  if (!spec) {
    return (
      <div className="my-4 rounded-xl border border-border bg-card p-4">
        <pre className="overflow-x-auto text-xs text-foreground/70">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  const W = 720
  const H = 400
  const pad = { top: 40, right: 24, bottom: 56, left: 56 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  const allVals = spec.datasets.flatMap((d) => d.data)
  const maxV = Math.max(...allVals, 0)
  const minV = Math.min(...allVals, 0)
  const range = maxV - minV || 1

  const x = (i: number) =>
    pad.left + (spec.labels.length <= 1 ? plotW / 2 : (i / (spec.labels.length - 1)) * plotW)
  const y = (v: number) => pad.top + plotH - ((v - minV) / range) * plotH

  const ticks = 4
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = minV + (range * i) / ticks
    return { v, yy: y(v) }
  })

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-border bg-[#0b0b0c] p-4">
      {spec.title && (
        <p className="mb-2 text-center text-sm font-medium text-white">
          {spec.title}
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
        {/* gridlines + y ticks */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              y1={g.yy}
              x2={W - pad.right}
              y2={g.yy}
              stroke="rgba(255,255,255,0.08)"
            />
            <text
              x={pad.left - 8}
              y={g.yy + 4}
              textAnchor="end"
              fontSize="11"
              fill="#8a8a8a"
            >
              {Math.round(g.v * 100) / 100}
            </text>
          </g>
        ))}

        {/* axes labels */}
        {spec.yLabel && (
          <text
            x={14}
            y={pad.top + plotH / 2}
            fontSize="11"
            fill="#a1a1aa"
            textAnchor="middle"
            transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
          >
            {spec.yLabel}
          </text>
        )}
        {spec.xLabel && (
          <text x={W / 2} y={H - 8} fontSize="11" fill="#a1a1aa" textAnchor="middle">
            {spec.xLabel}
          </text>
        )}

        {spec.type === "pie" ? (
          <Pie spec={spec} W={W} H={H} />
        ) : (
          <>
            {/* x labels */}
            {spec.labels.map((lab, i) => (
              <text
                key={i}
                x={
                  spec.type === "bar"
                    ? pad.left + ((i + 0.5) / spec.labels.length) * plotW
                    : x(i)
                }
                y={pad.top + plotH + 18}
                fontSize="11"
                fill="#8a8a8a"
                textAnchor="middle"
              >
                {lab}
              </text>
            ))}

            {spec.type === "bar"
              ? spec.datasets.map((ds, di) =>
                  ds.data.map((v, i) => {
                    const groupW = plotW / spec.labels.length
                    const barW = (groupW * 0.7) / spec.datasets.length
                    const bx =
                      pad.left +
                      i * groupW +
                      groupW * 0.15 +
                      di * barW
                    return (
                      <rect
                        key={`${di}-${i}`}
                        x={bx}
                        y={y(Math.max(v, 0))}
                        width={barW}
                        height={Math.abs(y(v) - y(0))}
                        fill={SHADES[di % SHADES.length]}
                        rx="2"
                      />
                    )
                  })
                )
              : spec.datasets.map((ds, di) => (
                  <g key={di}>
                    <polyline
                      points={ds.data.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                      fill="none"
                      stroke={SHADES[di % SHADES.length]}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {ds.data.map((v, i) => (
                      <circle
                        key={i}
                        cx={x(i)}
                        cy={y(v)}
                        r="3"
                        fill={SHADES[di % SHADES.length]}
                      />
                    ))}
                  </g>
                ))}
          </>
        )}
      </svg>

      {/* legend */}
      {spec.datasets.length > 1 && spec.datasets.some((d) => d.label) && (
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          {spec.datasets.map((ds, di) => (
            <span key={di} className="flex items-center gap-1.5 text-xs text-white/70">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: SHADES[di % SHADES.length] }}
              />
              {ds.label ?? `Series ${di + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Pie({ spec, W, H }: { spec: ChartSpec; W: number; H: number }) {
  const data = spec.datasets[0]?.data ?? []
  const total = data.reduce((a, b) => a + b, 0) || 1
  const cx = W / 2
  const cy = H / 2 - 10
  const r = Math.min(W, H) / 3.2
  let angle = -Math.PI / 2

  return (
    <>
      {data.map((v, i) => {
        const slice = (v / total) * Math.PI * 2
        const x1 = cx + r * Math.cos(angle)
        const y1 = cy + r * Math.sin(angle)
        angle += slice
        const x2 = cx + r * Math.cos(angle)
        const y2 = cy + r * Math.sin(angle)
        const large = slice > Math.PI ? 1 : 0
        const mid = angle - slice / 2
        const lx = cx + (r + 18) * Math.cos(mid)
        const ly = cy + (r + 18) * Math.sin(mid)
        return (
          <g key={i}>
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={SHADES[i % SHADES.length]}
              stroke="#0b0b0c"
              strokeWidth="2"
            />
            <text
              x={lx}
              y={ly}
              fontSize="11"
              fill="#c8c8c8"
              textAnchor={lx > cx ? "start" : "end"}
            >
              {spec.labels[i]} ({Math.round((v / total) * 100)}%)
            </text>
          </g>
        )
      })}
    </>
  )
}
