"use client"

import type { ReactNode } from "react"

// A small glass tooltip that appears on hover/focus — replaces the browser's
// default title= tooltip with something on-brand. Wrap any control.
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string
  children: ReactNode
  side?: "top" | "bottom"
}) {
  const pos =
    side === "top"
      ? "bottom-full mb-2 group-hover/tt:-translate-y-0 translate-y-1"
      : "top-full mt-2 group-hover/tt:translate-y-0 -translate-y-1"
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-[90] -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/12 bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white/90 opacity-0 backdrop-blur-md transition-all duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 ${pos}`}
      >
        {label}
      </span>
    </span>
  )
}
