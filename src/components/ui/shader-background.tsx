"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"
import { ambientTemperature } from "@/lib/color-temp"
import { LS_AUTO_MORNING, SETTINGS_EVENT, readLocalFlag, type UserSettings } from "@/lib/settings"

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
// Warm end of the ambient temperature curve (~3500K): the same monochrome
// world with a whisper of candle-lit amber.
const WARM = ["#0a0806", "#1a1512", "#3d352c", "#5d4f3f", "#221c15", "#453a2c"]
// Cool end (~6500K): the mirror image, tilted a few degrees toward blue
// instead of amber. Kept just as subtle as WARM — this is a temperature
// drift, not a colored filter.
const COOL = ["#05070a", "#0d1620", "#293f52", "#3f5972", "#111a22", "#2c4054"]
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
  // Manual Night control (⌘K "Toggle Night mode" / the evening prompt). Owned by
  // the NightMode component, mirrored here via localStorage + a custom event.
  //   "on"   → pin warm, regardless of the clock
  //   "off"  → pin neutral (no warm drift), so turning Night OFF actually looks
  //            off even in the evening/night when the clock would drift warm
  //   "auto" → follow the clock (the default when the user hasn't chosen)
  const [nightManual, setNightManual] = useState<"on" | "off" | "auto">("auto")
  // Auto Morning mode preference (default on). When off, the cool morning drift
  // is suppressed and the morning stays neutral gray.
  const [autoMorning, setAutoMorning] = useState(true)
  // The automatic drift itself — recomputed every minute so it's always a
  // couple of seconds fresh, cross-faded over ~2.4s so the update is never
  // visible as a jump.
  const [temp, setTemp] = useState(0)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem("sx-night")
      setNightManual(stored === "1" ? "on" : stored === "0" ? "off" : "auto")
      setAutoMorning(readLocalFlag(LS_AUTO_MORNING))
    } catch {}
    // A manual toggle always produces an explicit on/off (never "auto").
    const onNight = (e: Event) => setNightManual((e as CustomEvent<boolean>).detail ? "on" : "off")
    window.addEventListener("night-changed", onNight)
    // Live-update when the account's settings mirror lands after auth resolves.
    const onSettings = (e: Event) =>
      setAutoMorning(!!(e as CustomEvent<UserSettings>).detail?.autoMorning)
    window.addEventListener(SETTINGS_EVENT, onSettings)
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

    const syncTemp = () => setTemp(ambientTemperature())
    syncTemp()
    const interval = setInterval(syncTemp, 60_000)
    document.addEventListener("visibilitychange", syncTemp)

    return () => {
      reduced.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
      document.removeEventListener("visibilitychange", syncTemp)
      window.removeEventListener("night-changed", onNight)
      window.removeEventListener(SETTINGS_EVENT, onSettings)
      clearInterval(interval)
    }
  }, [])

  // Warm/cool weights, split so each cross-fades independently from neutral.
  //   Night "on"  → full warm, no cool.
  //   Night "off" → neutral (no warm), cool still allowed so an explicit off in
  //                 the morning doesn't kill the cool drift.
  //   Night "auto"→ follow the clock.
  const warmWeight = nightManual === "on" ? 1 : nightManual === "off" ? 0 : Math.max(0, temp)
  // Cool (morning) drift is gated by Auto Morning, and suppressed while Night is on.
  const coolWeight = nightManual === "on" ? 0 : autoMorning ? Math.max(0, -temp) : 0
  const idle = status === "idle"

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
            {/* Warm layer (~3500K) — cross-fades in as the clock approaches
                night, or fully when night mode is manually forced on. */}
            <div
              className="absolute inset-0 transition-opacity duration-[2400ms] ease-out"
              style={{ opacity: idle ? warmWeight * 0.85 : 0 }}
            >
              <MeshGradient
                {...common}
                colors={WARM}
                speed={animate && idle && warmWeight > 0.02 ? (calm ? 0.22 : 0.45) : 0}
              />
            </div>
            {/* Cool layer (~6500K) — the mirror image, present through the
                brightest part of the day. */}
            <div
              className="absolute inset-0 transition-opacity duration-[2400ms] ease-out"
              style={{ opacity: idle ? coolWeight * 0.8 : 0 }}
            >
              <MeshGradient
                {...common}
                colors={COOL}
                speed={animate && idle && coolWeight > 0.02 ? (calm ? 0.22 : 0.45) : 0}
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
                  : warmWeight > 0.15
                    ? "bg-[linear-gradient(160deg,#0a0806,#453a2c,#140f0a)]"
                    : coolWeight > 0.15
                      ? "bg-[linear-gradient(160deg,#05070a,#3f5972,#0d1620)]"
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
