"use client"

import { useEffect, useState } from "react"

// Shown once per login session, right after auth resolves: a full-bleed
// frosted-glass sheet covers the entire viewport instantly (no fade-in — the
// chat must never be visible even for a frame), holds just long enough to
// read, then fades away — opacity only — to reveal the chat smoothly.
//
// The backdrop uses plain backdrop-blur rather than the SVG refraction filter
// that powers `.liquid-glass` (that filter seams across a full-viewport element
// in Chromium). The refraction glass is reserved for the small floating panel
// in the center, which is where the "glassmorphic" reading actually lands.
export function WelcomeOverlay({
  name,
  kind = "login",
  onDone,
}: {
  name: string
  kind?: "login" | "register"
  onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  const isRegister = kind === "register"

  useEffect(() => {
    const hold = setTimeout(() => setLeaving(true), 2300)
    return () => clearTimeout(hold)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const done = setTimeout(onDone, 900)
    return () => clearTimeout(done)
  }, [leaving, onDone])

  const heading = isRegister
    ? `Welcome, ${name || "there"}`
    : `Welcome back${name ? `, ${name}` : ""}`
  const sub = isRegister ? "Everything's ready. Let's begin." : "Good to see you again."

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/45 px-4 backdrop-blur-3xl backdrop-saturate-150 transition-opacity duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* soft top sheen + directional light so the sheet reads as glass, not fog */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_12%,rgba(255,255,255,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.08),transparent_45%)]" />
      {/* edge vignette to keep the glass grounded rather than a flat wash */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_60px_rgba(0,0,0,0.42)]" />

      {/* text sits directly on the frosted glassmorphic backdrop — no boxed panel */}
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span
          className="anim-fade text-[11px] tracking-[0.55em] text-white/35"
          style={{ ["--delay" as string]: "160ms" }}
        >
          ✦ ✦ ✦
        </span>
        <h1
          className="anim-fade mt-1 text-4xl font-semibold tracking-tight text-white sm:text-5xl"
          style={{ ["--delay" as string]: "260ms" }}
        >
          {heading}
        </h1>
        <p
          className="anim-fade text-[15px] text-white/50"
          style={{ ["--delay" as string]: "400ms" }}
        >
          {sub}
        </p>
      </div>
    </div>
  )
}
