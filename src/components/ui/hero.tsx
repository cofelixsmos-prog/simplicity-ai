"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"
import { RotatingText } from "@/components/ui/rotating-text"
import { MadeIn } from "@/components/ui/made-in"

interface HeroProps {
  words?: string[]
  buttonText?: string
  onButtonClick?: () => void
}

export function Hero({
  words,
  buttonText = "Get early access",
  onButtonClick,
}: HeroProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)

  useEffect(() => {
    setMounted(true)

    try {
      const canvas = document.createElement("canvas")
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      setWebglSupported(!!gl)
    } catch {
      setWebglSupported(false)
    }

    const update = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  // Monochrome palette — wider range so the motion is actually visible.
  const colors = ["#000000", "#141414", "#3a3a3a", "#5a5a5a", "#1f1f1f", "#454545"]

  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-6">
      {/* Animated grayscale background */}
      <div className="absolute inset-0">
        {mounted &&
          (webglSupported ? (
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
        {/* Light vignette only — keeps edges deep without flattening the motion */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12.5px] font-medium tracking-wide text-white/70 backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-white/80" />
          India&apos;s second AI, after Sarvam
        </span>

        <h1 className="bg-gradient-to-b from-white to-white/55 bg-clip-text font-semibold tracking-tighter text-transparent leading-[0.95] text-6xl sm:text-8xl md:text-[8.5rem]">
          Simplicity
        </h1>

        <p className="mt-8 flex flex-wrap items-baseline justify-center gap-x-3 text-2xl sm:text-4xl font-light text-white/50">
          <span>Intelligence,</span>
          <RotatingText
            words={words}
            className="font-medium text-white [text-shadow:0_0_30px_rgba(255,255,255,0.25)]"
          />
        </p>

        <button
          onClick={onButtonClick}
          className="mt-14 rounded-full bg-white px-8 py-4 text-[15px] font-medium text-black transition-all duration-300 hover:shadow-[0_0_40px_-6px_rgba(255,255,255,0.6)]"
        >
          {buttonText}
        </button>

        <div className="mt-8">
          <MadeIn />
        </div>
      </div>
    </section>
  )
}
