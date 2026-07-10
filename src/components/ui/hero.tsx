"use client"

import { RotatingText } from "@/components/ui/rotating-text"
import { ShaderBackground } from "@/components/ui/shader-background"

interface HeroProps {
  words?: string[]
  buttonText?: string
  onButtonClick?: () => void
}

const WORDMARK = "Simplicity".split("")

export function Hero({
  words,
  buttonText = "Get early access",
  onButtonClick,
}: HeroProps) {
  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-4 sm:px-6">
      {/* Animated grayscale background (perf-tuned, shared component) */}
      <ShaderBackground />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div
          className="anim-rise mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-[12.5px] font-medium tracking-wide text-white/70 backdrop-blur-md"
          style={{ ["--delay" as string]: "0ms" }}
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-white/90" />
          </span>
          Introducing Simplicity R1
          <span className="hidden text-white/40 sm:inline">·</span>
          <span className="hidden text-white/50 sm:inline">frontier reasoning</span>
        </div>

        {/* wordmark — each letter rises out of a depth blur (splash motion language).
            The gradient clip lives on EACH letter: bg-clip-text on a parent goes
            invisible once children animate with filters/transforms. */}
        <h1
          aria-label="Simplicity"
          className="font-semibold leading-[0.95] tracking-tighter drop-shadow-[0_6px_44px_rgba(255,255,255,0.14)] text-[17vw] sm:text-7xl md:text-[7rem]"
        >
          {WORDMARK.map((ch, i) => (
            <span
              key={i}
              aria-hidden
              className="hero-letter bg-gradient-to-b from-white via-white to-white/50 bg-clip-text text-transparent"
              style={{ ["--i" as string]: i }}
            >
              {ch}
            </span>
          ))}
        </h1>

        <p
          className="anim-rise mt-6 flex flex-wrap items-baseline justify-center gap-x-3 text-2xl font-light text-white/50 sm:mt-8 sm:text-4xl"
          style={{ ["--delay" as string]: "760ms" }}
        >
          <span>Intelligence,</span>
          <RotatingText
            words={words}
            className="font-medium text-white [text-shadow:0_0_30px_rgba(255,255,255,0.25)]"
          />
        </p>

        <div
          className="anim-rise mt-10 flex flex-col items-center gap-3 sm:mt-12 sm:flex-row sm:gap-4"
          style={{ ["--delay" as string]: "900ms" }}
        >
          <button
            onClick={onButtonClick}
            className="w-full rounded-full bg-white px-8 py-4 text-[15px] font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_40px_-6px_rgba(255,255,255,0.6)] sm:w-auto"
          >
            {buttonText}
          </button>
          <a
            href="#capabilities"
            className="w-full rounded-full border border-white/15 px-8 py-4 text-center text-[15px] font-medium text-white/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:text-white sm:w-auto"
          >
            See what it does
          </a>
        </div>
      </div>

      {/* scroll cue — the story starts below */}
      <a
        href="#capabilities"
        aria-label="Scroll to see what it does"
        className="anim-rise absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 transition-colors hover:text-white/70"
        style={{ ["--delay" as string]: "1200ms" }}
      >
        <span className="flex h-9 w-6 items-start justify-center rounded-full border border-white/20 p-1.5">
          <span className="size-1 animate-bounce rounded-full bg-current" />
        </span>
      </a>
    </section>
  )
}
