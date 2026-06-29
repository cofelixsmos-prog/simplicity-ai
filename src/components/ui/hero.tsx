"use client"

import { RotatingText } from "@/components/ui/rotating-text"
import { ShaderBackground } from "@/components/ui/shader-background"

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
  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-6">
      {/* Animated grayscale background (perf-tuned, shared component) */}
      <ShaderBackground />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div
          className="anim-rise mb-7 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-[12.5px] font-medium tracking-wide text-white/70 backdrop-blur-md"
          style={{ ["--delay" as string]: "0ms" }}
        >
          <span className="size-1.5 rounded-full bg-white/80" />
          Simplicity India
          <span aria-hidden>🇮🇳</span>
        </div>
        <h1
          className="anim-rise bg-gradient-to-b from-white via-white to-white/50 bg-clip-text font-semibold tracking-tighter text-transparent leading-[0.95] text-5xl sm:text-7xl md:text-[7rem] drop-shadow-[0_6px_44px_rgba(255,255,255,0.14)]"
          style={{ ["--delay" as string]: "120ms" }}
        >
          Simplicity
        </h1>

        <p
          className="anim-rise mt-8 flex flex-wrap items-baseline justify-center gap-x-3 text-2xl sm:text-4xl font-light text-white/50"
          style={{ ["--delay" as string]: "200ms" }}
        >
          <span>Intelligence,</span>
          <RotatingText
            words={words}
            className="font-medium text-white [text-shadow:0_0_30px_rgba(255,255,255,0.25)]"
          />
        </p>

        <button
          onClick={onButtonClick}
          style={{ ["--delay" as string]: "340ms" }}
          className="anim-rise mt-14 rounded-full bg-white px-8 py-4 text-[15px] font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_40px_-6px_rgba(255,255,255,0.6)]"
        >
          {buttonText}
        </button>
      </div>
    </section>
  )
}
