"use client"

import { ArrowRight } from "lucide-react"
import { Reveal } from "@/components/ui/reveal"

interface ModelSpec {
  label: string
  value: string
}

interface Model {
  id: string
  codename: string
  name: string
  tagline: string
  description: string
  badge: string
  flagship?: boolean
  specs: ModelSpec[]
  ctaText: string
}

interface ModelsSectionProps {
  models?: Model[]
  onModelClick?: (id: string) => void
}

const defaultModels: Model[] = [
  {
    id: "r1",
    codename: "R1",
    name: "Simplicity R1",
    tagline: "One model. Everything you need.",
    description:
      "Fast, capable, and always on. Built to focus, research, build real deliverables, and orchestrate a swarm of agents — without the noise of choosing between models.",
    badge: "Flagship",
    flagship: true,
    specs: [
      { label: "Context window", value: "128K tokens" },
      { label: "Tools", value: "Full agentic suite" },
      { label: "Availability", value: "Free, always on" },
    ],
    ctaText: "Get started",
  },
]

export function ModelsSection({
  models = defaultModels,
  onModelClick,
}: ModelsSectionProps) {
  return (
    <section
      id="models"
      className="relative z-10 w-full bg-background py-28 sm:py-36 px-6"
    >
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-16 sm:mb-20 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground mb-5">
            Models
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-semibold tracking-tight leading-[1.1] text-foreground">
            One model. No decisions.
          </h2>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
            No dropdown of tradeoffs to agonize over — just one capable model,
            tuned to do everything Simplicity does, always on.
          </p>
        </Reveal>

        <Reveal delay={120} className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {models.map((model) => (
            <article
              key={model.id}
              className="group relative flex flex-col bg-card p-8 sm:p-10 transition-colors duration-300 hover:bg-secondary/40"
            >
              {/* Header row: codename + badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 font-mono text-sm font-medium text-foreground">
                    {model.codename}
                  </span>
                  {model.flagship && (
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {model.badge}
                    </span>
                  )}
                </div>
                {!model.flagship && (
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {model.badge}
                  </span>
                )}
              </div>

              <h3 className="mt-7 text-2xl font-semibold tracking-tight text-foreground">
                {model.name}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {model.tagline}
              </p>
              <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                {model.description}
              </p>

              {/* Spec table */}
              <dl className="mt-8 divide-y divide-border border-t border-border">
                {model.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex items-center justify-between py-3"
                  >
                    <dt className="text-sm text-muted-foreground">
                      {spec.label}
                    </dt>
                    <dd className="text-sm font-medium text-foreground">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <button
                onClick={() => onModelClick?.(model.id)}
                className={`mt-9 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  model.flagship
                    ? "bg-foreground text-background hover:opacity-90"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {model.ctaText}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
