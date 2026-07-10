"use client"

import { ArrowRight } from "lucide-react"
import { Reveal } from "@/components/ui/reveal"

// The closing moment of the landing page: one quiet, confident ask.
export function CtaSection({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="relative z-10 w-full bg-background px-6 pb-32 pt-8 sm:pb-40">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-8 py-16 text-center sm:px-16 sm:py-20">
            {/* soft center glow */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07] blur-3xl" />

            <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Think clearer.
              <br />
              <span className="text-white/45">Ship faster. Stay calm.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Simplicity R1 is free during early access. No card, no queue — just sign up and start.
            </p>
            <button
              onClick={onCtaClick}
              className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-[15px] font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_44px_-6px_rgba(255,255,255,0.55)]"
            >
              Get early access
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
