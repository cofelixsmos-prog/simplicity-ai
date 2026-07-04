"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

// Soft animated monochrome shader background. Tuned for performance: the render
// is capped to a low pixel count (it's a blurry gradient, so it upscales fine),
// the device-pixel-ratio is pinned to 1, and the animation freezes when the tab
// is hidden or the user prefers reduced motion — so it stops pegging the main
// thread / draining battery.
const COLORS = ["#000000", "#141414", "#3a3a3a", "#5a5a5a", "#1f1f1f", "#454545"]
// Colored palettes for the status layers — deep and cinematic, not neon, so the
// whole animated gradient turns red/green rather than flashing a flat tint.
const RED = ["#0a0000", "#2a0606", "#6b1212", "#9e1b1b", "#1a0303", "#4a0d0d"]
const GREEN = ["#00100a", "#0a2e1e", "#12613f", "#1c8a58", "#061f14", "#0f4d31"]
// Night: the same monochrome world with just a whisper of warmth — close to
// the gray palette in value/saturation, tilted a few degrees toward amber.
const NIGHT = ["#0a0806", "#1a1512", "#3d352c", "#5d4f3f", "#221c15", "#453a2c"]
const MAX_PIXELS = 1280 * 720 // cap GPU/CPU work regardless of screen size

// Ambient status: the environment quietly reflects what the app is doing.
// "idle" (gray, default: talking, typing, thinking), "error" (a slow red wash),
// "success" (a brief green wash). The washes fade over ~1.2s so it never flashes.
export type BgStatus = "idle" | "error" | "success"

export function ShaderBackground({
  fixed = false,
  status = "idle",
  calm = false,
}: {
  fixed?: boolean
  status?: BgStatus
  // When there's content to read (a panel open, an answer streaming), the world
  // recedes: the animation slows and a soft dim settles in so glass stays legible.
  calm?: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(true)
  const [animate, setAnimate] = useState(true)
  // Night mode tints the animation itself (a warm layer cross-fades into the
  // gradient) rather than painting an overlay on top. State is owned by the
  // NightMode component; we mirror it via localStorage + the night-changed event.
  const [night, setNight] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setNight(localStorage.getItem("sx-night") === "1")
    } catch {}
    const onNight = (e: Event) => setNight(!!(e as CustomEvent<boolean>).detail)
    window.addEventListener("night-changed", onNight)
    try {
      const c = document.createElement("canvas")
      const gl =
        c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl")
      setWebgl(!!gl)
    } catch {
      setWebgl(false)
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setAnimate(!reduced.matches && document.visibilityState !== "hidden")
    sync()
    reduced.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    return () => {
      reduced.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
      window.removeEventListener("night-changed", onNight)
    }
  }, [])

  const common = {
    style: { width: "100%", height: "100%" } as const,
    distortion: 1.3,
    swirl: 0.9,
    grainMixer: 0,
    grainOverlay: 0,
    offsetX: 0,
    minPixelRatio: 1,
    maxPixelCount: MAX_PIXELS,
  }

  return (
    <div className={`${fixed ? "fixed" : "absolute"} inset-0 -z-0 overflow-hidden bg-background`}>
      {mounted &&
        (webgl ? (
          <>
            {/* Base gray shader — always animating (slower when calm). */}
            <MeshGradient {...common} colors={COLORS} speed={animate ? (calm ? 0.28 : 0.6) : 0} />
            {/* Night layer — the same living gradient in candle-lit ambers. It
                cross-fades INTO the animation (drifting slightly slower), so night
                is part of the world, not a wash painted over it. */}
            <div
              className={`absolute inset-0 transition-opacity duration-[2400ms] ease-out ${
                night && status === "idle" ? "opacity-[0.88]" : "opacity-0"
              }`}
            >
              <MeshGradient
                {...common}
                colors={NIGHT}
                speed={animate && night && status === "idle" ? (calm ? 0.22 : 0.45) : 0}
              />
            </div>
            {/* Red status layer — a full red animated gradient that cross-fades over
                the gray. Frozen while hidden so it costs nothing when idle. */}
            <div
              className={`absolute inset-0 transition-opacity duration-[1800ms] ease-out ${
                status === "error" ? "opacity-100" : "opacity-0"
              }`}
            >
              <MeshGradient {...common} colors={RED} speed={animate && status === "error" ? 0.95 : 0} />
            </div>
            {/* Green status layer — the "return to work" acknowledgment. */}
            <div
              className={`absolute inset-0 transition-opacity duration-[1800ms] ease-out ${
                status === "success" ? "opacity-100" : "opacity-0"
              }`}
            >
              <MeshGradient {...common} colors={GREEN} speed={animate && status === "success" ? 0.6 : 0} />
            </div>
          </>
        ) : (
          <div
            className={`absolute inset-0 transition-colors duration-[1200ms] ${
              status === "error"
                ? "bg-[linear-gradient(160deg,#2a0606,#9e1b1b,#1a0303)]"
                : status === "success"
                  ? "bg-[linear-gradient(160deg,#0a2e1e,#1c8a58,#061f14)]"
                  : night
                    ? "bg-[linear-gradient(160deg,#0a0806,#453a2c,#140f0a)]"
                    : "bg-[linear-gradient(160deg,#000,#3a3a3a,#0a0a0a)]"
            }`}
          />
        ))}
      {/* calm dim — the world recedes when there's content to read */}
      <div
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-[1800ms] ease-out ${
          calm ? "opacity-40" : "opacity-0"
        }`}
      />
      {/* vignette to keep edges deep */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  )
}
