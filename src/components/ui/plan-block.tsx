"use client"

import { Check, X } from "lucide-react"

interface PlanSpec {
  title?: string
  steps: string[]
}

function parse(code: string): PlanSpec | null {
  try {
    const o = JSON.parse(code.trim())
    if (!o || !Array.isArray(o.steps)) return null
    return o as PlanSpec
  } catch {
    return null
  }
}

export function PlanBlock({
  code,
  streaming = false,
  decided = null,
  onApprove,
  onDeny,
}: {
  code: string
  streaming?: boolean
  decided?: "approved" | "denied" | null
  onApprove?: () => void
  onDeny?: () => void
}) {
  const spec = parse(code)

  if (streaming) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
        <span className="size-1.5 animate-pulse rounded-full bg-white/50" />
        Drafting a plan…
      </div>
    )
  }
  if (!spec) return null

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]">
      <div className="border-b border-white/8 px-5 py-3">
        <p className="text-sm font-semibold text-white">{spec.title ?? "Plan"}</p>
      </div>
      <ol className="space-y-3 px-5 py-4">
        {spec.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-white/85">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[11px] font-medium text-white/70">
              {i + 1}
            </span>
            <span className="leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 border-t border-white/8 px-5 py-3">
        {decided === null ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              <Check className="size-3.5" /> Approve
            </button>
            <button
              type="button"
              onClick={onDeny}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              <X className="size-3.5" /> Deny
            </button>
          </>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              decided === "approved" ? "text-emerald-400" : "text-white/40"
            }`}
          >
            {decided === "approved" ? (
              <><Check className="size-3.5" /> Approved</>
            ) : (
              <><X className="size-3.5" /> Denied</>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
