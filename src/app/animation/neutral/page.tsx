"use client"

import { useState } from "react"
import Link from "next/link"
import { MeshGradient } from "@paper-design/shaders-react"
import { ArrowLeft, Moon, Sun, Sunrise } from "lucide-react"

// Full-screen viewer for the Neutral (default) background and its two ambient
// tints. The real ShaderBackground derives the tints from the clock — Morning
// only appears ~6–11am — so this renders the layers directly with the exact
// same palettes and parameters, letting you inspect any state at any hour.
//
// Values below are copied verbatim from shader-background.tsx.
const BASE = ["#000000", "#141414", "#3a3a3a", "#5a5a5a", "#1f1f1f", "#454545"]
const WARM = ["#0a0806", "#1a1512", "#3d352c", "#5d4f3f", "#221c15", "#453a2c"]
const COOL = ["#05070a", "#0d1620", "#293f52", "#3f5972", "#111a22", "#2c4054"]

const MAX_PIXELS = 1280 * 720
const SIZING = { minPixelRatio: 1, maxPixelCount: MAX_PIXELS }
const FULL = { style: { width: "100%", height: "100%" } as const }

// Shared MeshGradient params — identical to the app's.
const MESH = {
  distortion: 1.3,
  swirl: 0.9,
  grainMixer: 0,
  grainOverlay: 0,
  offsetX: 0,
}

type Mode = "neutral" | "night" | "morning"

const MODES: { id: Mode; label: string; icon: typeof Moon; desc: string }[] = [
  { id: "neutral", label: "Neutral", icon: Sun, desc: "Base graphite — the resting default" },
  { id: "night", label: "Night", icon: Moon, desc: "Warm amber overlay at 85%" },
  { id: "morning", label: "Morning", icon: Sunrise, desc: "Cool blue overlay at 80%" },
]

export default function NeutralAnimationPage() {
  const [mode, setMode] = useState<Mode>("neutral")
  // `calm` in the app halves the speed; mirror that toggle here.
  const [calm, setCalm] = useState(true)
  const [chrome, setChrome] = useState(true)

  const baseSpeed = calm ? 0.28 : 0.6
  const tintSpeed = calm ? 0.22 : 0.45

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      {/* base layer — always present, exactly as in the app */}
      <div className="absolute inset-0">
        <MeshGradient {...FULL} {...SIZING} {...MESH} colors={BASE} speed={baseSpeed} />
      </div>

      {/* warm (night) tint */}
      <div
        className="absolute inset-0 transition-opacity duration-[2400ms] ease-out"
        style={{ opacity: mode === "night" ? 0.85 : 0 }}
      >
        <MeshGradient
          {...FULL}
          {...SIZING}
          {...MESH}
          colors={WARM}
          speed={mode === "night" ? tintSpeed : 0}
        />
      </div>

      {/* cool (morning) tint */}
      <div
        className="absolute inset-0 transition-opacity duration-[2400ms] ease-out"
        style={{ opacity: mode === "morning" ? 0.8 : 0 }}
      >
        <MeshGradient
          {...FULL}
          {...SIZING}
          {...MESH}
          colors={COOL}
          speed={mode === "morning" ? tintSpeed : 0}
        />
      </div>

      {/* the app's vignette, so this matches what users actually see */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

      {/* controls */}
      {chrome && (
        <>
          <Link
            href="/animation"
            className="absolute left-6 top-6 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3.5 py-2 text-[13px] text-white/70 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            All animations
          </Link>

          <button
            onClick={() => setChrome(false)}
            className="absolute right-6 top-6 z-10 rounded-full border border-white/15 bg-black/40 px-3.5 py-2 text-[12px] text-white/60 backdrop-blur-xl transition-colors hover:text-white"
          >
            Hide UI
          </button>

          <div className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-4 px-6">
            <div className="flex gap-1.5 rounded-full border border-white/12 bg-black/50 p-1.5 backdrop-blur-xl">
              {MODES.map((m) => {
                const Icon = m.icon
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
                      active ? "bg-white text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {m.label}
                  </button>
                )
              })}
            </div>

            <p className="text-center text-[12px] text-white/45">
              {MODES.find((m) => m.id === mode)?.desc}
            </p>

            <button
              onClick={() => setCalm((c) => !c)}
              className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[11px] text-white/50 backdrop-blur-xl transition-colors hover:text-white"
            >
              Speed: {calm ? "calm" : "normal"}
            </button>
          </div>
        </>
      )}

      {!chrome && (
        <button
          onClick={() => setChrome(true)}
          className="absolute right-6 top-6 z-10 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-white/35 backdrop-blur-xl transition-colors hover:text-white"
        >
          Show UI
        </button>
      )}
    </main>
  )
}
