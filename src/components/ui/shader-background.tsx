"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

// Soft animated monochrome shader background. Tuned for performance: the render
// is capped to a low pixel count (it's a blurry gradient, so it upscales fine),
// the device-pixel-ratio is pinned to 1, and the animation freezes when the tab
// is hidden or the user prefers reduced motion — so it stops pegging the main
// thread / draining battery.
const COLORS = ["#000000", "#141414", "#3a3a3a", "#5a5a5a", "#1f1f1f", "#454545"]
const MAX_PIXELS = 1280 * 720 // cap GPU/CPU work regardless of screen size

export function ShaderBackground({ fixed = false }: { fixed?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(true)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    setMounted(true)
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
    }
  }, [])

  return (
    <div className={`${fixed ? "fixed" : "absolute"} inset-0 -z-0 overflow-hidden bg-background`}>
      {mounted &&
        (webgl ? (
          <MeshGradient
            style={{ width: "100%", height: "100%" }}
            colors={COLORS}
            distortion={1.3}
            swirl={0.9}
            grainMixer={0}
            grainOverlay={0}
            speed={animate ? 0.6 : 0}
            offsetX={0}
            minPixelRatio={1}
            maxPixelCount={MAX_PIXELS}
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#000,#3a3a3a,#0a0a0a)]" />
        ))}
      {/* vignette to keep edges deep */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  )
}
