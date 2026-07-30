"use client"

import { useState } from "react"
import { Sparkles, ChevronRight } from "lucide-react"

export interface FusionDebugData {
  drafts: { label: string; model: string; text: string }[]
  critique: string
}

const COLORS: Record<string, string> = {
  Skeptic: "#818cf8", Visionary: "#f472b6", Logician: "#2dd4bf", Engineer: "#fbbf24",
}

// DEV-ONLY inspector for a Vordex turn — the raw persona drafts + the critique.
// The server only sends this data outside production, and this render is gated
// behind NODE_ENV in the parent, so it never ships to real users.
export function FusionDebug({ data }: { data: FusionDebugData }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"models" | "critique">("models")
  const [openDraft, setOpenDraft] = useState<number | null>(null)

  const live = data.drafts.filter((d) => d.text.trim()).length

  return (
    <div className="mt-2.5 w-fit max-w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80"
      >
        <Sparkles className="size-3.5 text-white/40 group-hover:text-white/60" />
        <span className="font-light" style={{ transform: "skewX(-1.5deg)" }}>fusion process</span>
        <span className="rounded bg-white/10 px-1.5 text-[9px] font-medium uppercase tracking-wider text-white/40">dev</span>
        <ChevronRight className={`size-3.5 text-white/35 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 w-[560px] max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur">
          {/* tabs */}
          <div className="flex items-center gap-1 border-b border-white/[0.07] p-1.5">
            <Tab active={tab === "models"} onClick={() => setTab("models")}>{live}/{data.drafts.length} models</Tab>
            <Tab active={tab === "critique"} onClick={() => setTab("critique")}>Cross-critique</Tab>
          </div>

          {tab === "models" && (
            <div className="flex flex-col gap-1 p-2">
              {data.drafts.map((d, i) => (
                <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <button onClick={() => setOpenDraft(openDraft === i ? null : i)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                    <span className="size-2 rounded-full" style={{ background: COLORS[d.label] ?? "#888" }} />
                    <span className="text-[12.5px] font-medium text-white/85">{d.label}</span>
                    <span className="font-mono text-[10.5px] text-white/30">{d.model}</span>
                    {!d.text.trim() && <span className="text-[10px] text-red-400/70">empty</span>}
                    <ChevronRight className={`ml-auto size-3.5 text-white/25 transition-transform ${openDraft === i ? "rotate-90" : ""}`} />
                  </button>
                  {openDraft === i && (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-white/[0.05] px-3 py-2.5 text-[12px] leading-relaxed text-white/60" data-lenis-prevent>{d.text || "(no output)"}</pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "critique" && (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-3.5 text-[12px] leading-relaxed text-white/60" data-lenis-prevent>
              {data.critique?.trim() || "(no critique — needs 2+ drafts)"}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${active ? "bg-white/10 text-white/85" : "text-white/45 hover:text-white/70"}`}
    >
      {children}
    </button>
  )
}
