"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LS_BG_THEME, type BgTheme } from "@/lib/settings"

// A gallery of every background animation type, rendered live side by side.
// Each tile mounts the real ShaderBackground so what you see here is exactly
// what the app renders — no mock-ups.
//
// NOTE: every tile is its own WebGL context. Browsers cap how many can be
// active at once (~8–16), so tiles render only when switched on. "Play all"
// exists for comparison but will be heavy — especially on phones.

interface Entry {
  id: BgTheme
  name: string
  note: string
}

const MESH: Entry[] = [
  { id: "default", name: "Default", note: "Neutral graphite" },
  { id: "aurora", name: "Aurora", note: "Teal / deep sea" },
  { id: "ocean", name: "Ocean", note: "Blue depth" },
  { id: "sunset", name: "Sunset", note: "Ember orange" },
  { id: "lavender", name: "Lavender", note: "Soft violet" },
  { id: "emerald", name: "Emerald", note: "Deep green" },
  { id: "midnight", name: "Midnight", note: "Near-black indigo" },
  { id: "macOS", name: "macOS", note: "Bright spectrum" },
  { id: "candy", name: "Candy", note: "Pink / cyan pop" },
  { id: "neon", name: "Neon", note: "Electric high-contrast" },
  { id: "rose", name: "Rose", note: "Wine / blush" },
  { id: "golden", name: "Golden", note: "Warm amber" },
  { id: "arctic", name: "Arctic", note: "Pale ice (light)" },
]

const ALTERNATE: Entry[] = [
  { id: "metaballs", name: "Metaballs", note: "Fluid blobs" },
  { id: "neuro", name: "Neuro Noise", note: "Neural filaments" },
  { id: "smoke", name: "Smoke Ring", note: "Drifting vapor ring" },
  { id: "godrays", name: "God Rays", note: "Volumetric light shafts" },
  { id: "warp", name: "Warp", note: "Checked distortion" },
  { id: "swirl", name: "Swirl", note: "Banded rotation" },
  { id: "grain", name: "Grain Gradient", note: "Film-grain wash" },
  { id: "dots", name: "Dot Orbit", note: "Orbiting dot field" },
]

const PLAIN: Entry[] = [{ id: "plain-black", name: "Plain Black", note: "No shader — pure black" }]

function ShaderTile({ entry, on, onToggle }: { entry: Entry; on: boolean; onToggle: () => void }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {on ? (
          // Scoped to this tile: ShaderBackground fills its nearest positioned
          // ancestor when `fixed` is false.
          <ShaderTilePreview theme={entry.id} />
        ) : (
          <button
            onClick={onToggle}
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent text-xs font-medium text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
          >
            ▶ Play
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">{entry.name}</p>
          <p className="truncate text-[11px] text-white/40">{entry.note}</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/45">
            {entry.id}
          </code>
          {on && (
            <button
              onClick={onToggle}
              className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/50 transition-colors hover:text-white"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ShaderBackground reads its theme from localStorage on mount, so write the key
// first and only then render it. Doing the write in an effect (rather than
// during render) keeps render pure; `ready` gates the mount until it's set.
function ShaderTilePreview({ theme }: { theme: BgTheme }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(LS_BG_THEME, theme)
    } catch {}
    setReady(true)
  }, [theme])

  if (!ready) return <div className="absolute inset-0 bg-white/[0.03]" />
  return (
    <div className="absolute inset-0">
      <ShaderBackground key={theme} calm />
    </div>
  )
}

export default function AnimationPage() {
  const [live, setLive] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setLive((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allIds = [...MESH, ...ALTERNATE, ...PLAIN].map((e) => e.id)
  const allOn = live.size === allIds.length

  const section = (title: string, subtitle: string, entries: Entry[]) => (
    <section className="mb-14">
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        <p className="mt-1 text-[13px] text-white/45">{subtitle}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <ShaderTile key={e.id} entry={e} on={live.has(e.id)} onToggle={() => toggle(e.id)} />
        ))}
      </div>
    </section>
  )

  return (
    <main className="min-h-dvh bg-[#08080a] px-6 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-white/45 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <header className="mb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/35">Reference</p>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight">Background animations</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/50">
            Every background type available in Simplicity, rendered live. Each tile is a real WebGL
            context, so they start paused — press Play on the ones you want to compare.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setLive(allOn ? new Set() : new Set(allIds))}
              className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
            >
              {allOn ? "Stop all" : "Play all"}
            </button>
            <Link
              href="/animation/neutral"
              className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Full screen: Neutral + Night / Morning
            </Link>
            <span className="text-[12px] text-white/35">
              {live.size} of {allIds.length} running
            </span>
          </div>

          {live.size > 6 && (
            <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-2.5 text-[12px] text-amber-200/90">
              Running many shaders at once is GPU-heavy — browsers limit concurrent WebGL contexts,
              and phones may stutter or drop tiles.
            </p>
          )}
        </header>

        {section(
          "Mesh gradients",
          "One MeshGradient shader with a different 6-colour palette. These are the default family.",
          MESH
        )}
        {section(
          "Alternate shaders",
          "Distinct shader programs, each with its own motion and geometry.",
          ALTERNATE
        )}
        {section("Non-shader", "No WebGL — the lightest option.", PLAIN)}
      </div>
    </main>
  )
}
