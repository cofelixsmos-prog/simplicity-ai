"use client"

import { ArrowUpRight } from "lucide-react"
import { Reveal } from "@/components/ui/reveal"

export function PartnersSection() {
  return (
    <section className="relative z-10 w-full bg-background px-6 py-28 sm:py-40">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mb-16">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Partners
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Building with frontier researchers.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Simplicity partners with organizations advancing breakthrough research and emerging
              technologies.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-foreground">The ZSMC Co.</h3>
                <p className="mt-2 text-sm font-medium text-white/60">
                  Electrochemical Energy Storage & Research
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                  Independent research initiative focused on electrochemical energy storage,
                  materials science, computational systems, and applied artificial intelligence.
                </p>
              </div>
              <a
                href="https://thezsmc.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:mt-0"
              >
                Visit <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-10 text-center">
            <a
              href="/partners"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Explore all partners <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
