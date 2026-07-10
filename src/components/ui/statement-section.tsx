"use client"

import { Reveal } from "@/components/ui/reveal"

// A quiet editorial beat between the hero and the feature showcase: one large
// typographic statement, no boxes, lots of air.
export function StatementSection() {
  return (
    <section className="relative z-10 w-full bg-background px-6 py-28 sm:py-40">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <p className="text-balance text-3xl font-light leading-[1.25] tracking-tight text-white/35 sm:text-5xl sm:leading-[1.2]">
            Most AI tools pile on features, tabs, and noise.{" "}
            <span className="font-medium text-white">
              Simplicity does the opposite — it clears everything away until only your work is left.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
