"use client"

import { useEffect, useState } from "react"

// Shown once per login session, right after auth resolves: a full-bleed
// frosted-glass sheet covers the entire viewport instantly (no fade-in — the
// chat must never be visible even for a frame), holds just long enough to
// read, then fades away — opacity only, no bounce or scale — to reveal the
// chat smoothly.
//
// Uses plain backdrop-blur rather than the SVG refraction filter that powers
// `.liquid-glass` — that filter doesn't tile cleanly across a full-viewport
// element in Chromium (visible seam), and is meant for small floating cards
// anyway. A heavier blur + tint here fully obscures the chat, which a small
// card's translucent glass deliberately does not.
export function WelcomeOverlay({ name, onDone }: { name: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const hold = setTimeout(() => setLeaving(true), 2100)
    return () => clearTimeout(hold)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const done = setTimeout(onDone, 900)
    return () => clearTimeout(done)
  }, [leaving, onDone])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 px-4 backdrop-blur-3xl backdrop-saturate-150 transition-opacity duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* soft top sheen so the frosted sheet reads as glass, not fog */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_15%,rgba(255,255,255,0.12),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.07),transparent_45%)]" />
      {/* edge vignette to keep the glass grounded rather than a flat wash */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_50px_rgba(0,0,0,0.4)]" />

      <div className="relative flex flex-col items-center gap-2.5 text-center">
        <span
          className="anim-fade text-[10px] tracking-[0.6em] text-white/30"
          style={{ ["--delay" as string]: "80ms" }}
        >
          ✦ ✦ ✦
        </span>
        <h1
          className="anim-fade mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl"
          style={{ ["--delay" as string]: "180ms" }}
        >
          Welcome back{name ? `, ${name}` : ""}
        </h1>
        <p className="anim-fade text-[15px] text-white/45" style={{ ["--delay" as string]: "320ms" }}>
          Good to see you again.
        </p>
      </div>
    </div>
  )
}
