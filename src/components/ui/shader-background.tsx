"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

// The same animated monochrome shader used on the landing hero,
// reusable as a fixed full-screen background.
export function ShaderBackground({ fixed = false }: { fixed?: boolean }) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    setMounted(true)
    try {
      const c = document.createElement("canvas")
      const gl =
        c.getContext("webgl2") ||
        c.getContext("webgl") ||
        c.getContext("experimental-webgl")
      setWebgl(!!gl)
    } catch {
      setWebgl(false)
    }
    const update = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const colors = ["#000000", "#141414", "#3a3a3a", "#5a5a5a", "#1f1f1f", "#454545"]

  return (
    <div className={`${fixed ? "fixed" : "absolute"} inset-0 -z-0 overflow-hidden bg-background`}>
      {mounted &&
        (webgl ? (
          <MeshGradient
            width={dimensions.width}
            height={dimensions.height}
            colors={colors}
            distortion={1.3}
            swirl={0.9}
            grainMixer={0}
            grainOverlay={0}
            speed={0.7}
            offsetX={0}
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#000,#3a3a3a,#0a0a0a)]" />
        ))}
      {/* vignette to keep edges deep */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  )
}
