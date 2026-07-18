"use client"

import { useEffect, useRef } from "react"
import { ArrowRight } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface ModelCard {
  id: string
  codename: string
  name: string
  tagline: string
  description: string
  badge: string
  gradient: string
  iconPath: string
  specs: { label: string; value: string }[]
}

const MODELS: ModelCard[] = [
  {
    id: "r1",
    codename: "R1",
    name: "Simplicity R1",
    tagline: "Flagship reasoning model",
    description:
      "Fast, capable, and always on. Built to focus, research, build real deliverables, and orchestrate a swarm of agents.",
    badge: "Flagship",
    gradient: "from-violet-500/30 via-indigo-500/20 to-purple-600/30",
    iconPath: "M50 20 C50 20 80 50 50 80 C20 50 50 20 50 20Z M50 30 C50 30 70 50 50 70 C30 50 50 30 50 30Z",
    specs: [
      { label: "Parameters", value: "140B" },
      { label: "Context", value: "128K tokens" },
      { label: "Availability", value: "Free" },
    ],
  },
]

export function ModelsSection({ onModelClick }: { onModelClick?: (id: string) => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const orbitRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const heading = headingRef.current
    const cards = cardsRef.current
    const orbit = orbitRef.current
    if (!section || !heading || !cards || !orbit) return

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) return

    const ctx = gsap.context(() => {
      // heading slides up from below with rotation
      gsap.from(heading.querySelectorAll("p, h2, .desc"), {
        y: 80,
        opacity: 0,
        rotateX: 15,
        stagger: 0.15,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: heading,
          start: "top 85%",
          once: true,
        },
      })

      // orbit decoration spins continuously while in view
      gsap.to(orbit, {
        rotation: 360,
        duration: 30,
        repeat: -1,
        ease: "none",
      })

      // parallax float on orbit
      gsap.fromTo(
        orbit,
        { y: 80 },
        {
          y: -80,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        }
      )

      // cards: each slides in from alternating directions with rotation
      const cardEls = cards.children
      for (let i = 0; i < cardEls.length; i++) {
        const fromLeft = i % 2 === 0
        gsap.from(cardEls[i], {
          x: fromLeft ? -120 : 120,
          y: 60,
          opacity: 0,
          rotation: fromLeft ? -6 : 6,
          scale: 0.9,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: cardEls[i],
            start: "top 90%",
            once: true,
          },
        })

        // icons inside cards spin into view
        const icon = cardEls[i].querySelector(".model-icon")
        if (icon) {
          gsap.from(icon, {
            rotation: -180,
            scale: 0,
            opacity: 0,
            duration: 0.8,
            delay: 0.3,
            ease: "back.out(1.7)",
            scrollTrigger: {
              trigger: cardEls[i],
              start: "top 90%",
              once: true,
            },
          })
        }

        // specs slide up vertically one by one
        const specs = cardEls[i].querySelectorAll(".spec-row")
        gsap.from(specs, {
          y: 30,
          opacity: 0,
          stagger: 0.08,
          duration: 0.5,
          delay: 0.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: cardEls[i],
            start: "top 90%",
            once: true,
          },
        })
      }
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="models"
      className="relative z-10 w-full overflow-hidden bg-background py-28 sm:py-36 px-6"
    >
      {/* rotating orbit decoration */}
      <svg
        ref={orbitRef}
        className="pointer-events-none absolute right-[-10%] top-[20%] size-[600px] text-white/[0.03] sm:size-[800px]"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden
      >
        <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.3" />
        <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="0.3" strokeDasharray="4 6" />
        <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="0.3" />
        <circle cx="100" cy="5" r="2" fill="currentColor" />
        <circle cx="170" cy="100" r="1.5" fill="currentColor" />
        <circle cx="55" cy="160" r="1.5" fill="currentColor" />
      </svg>

      <div className="relative mx-auto max-w-6xl">
        <div ref={headingRef} className="mb-16 sm:mb-20 max-w-2xl" style={{ perspective: "600px" }}>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground mb-5">
            Models
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-semibold tracking-tight leading-[1.1] text-foreground">
            A family of models.
          </h2>
          <p className="desc mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Each model is purpose-built for a different kind of work — from
            everyday reasoning to deep research, code, and creative output.
          </p>
        </div>

        <div ref={cardsRef} className="grid gap-5 sm:grid-cols-2">
          {MODELS.map((model) => (
            <article
              key={model.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0d11] transition-colors duration-300 hover:border-white/[0.15]"
            >
              {/* gradient banner */}
              <div className={`relative h-36 bg-gradient-to-br ${model.gradient} flex items-center justify-center`}>
                <svg viewBox="0 0 100 100" className="model-icon size-16 text-white/60" aria-hidden>
                  <path d={model.iconPath} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                </svg>
                <span className="absolute top-4 right-4 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70 backdrop-blur-sm">
                  {model.badge}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-md border border-white/12 px-2 font-mono text-xs font-medium text-foreground">
                    {model.codename}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {model.name}
                  </h3>
                </div>
                <p className="text-sm font-medium text-white/60 mb-2">{model.tagline}</p>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground mb-6">
                  {model.description}
                </p>

                {/* specs */}
                <dl className="mt-auto divide-y divide-white/[0.06] border-t border-white/[0.06]">
                  {model.specs.map((spec) => (
                    <div key={spec.label} className="spec-row flex items-center justify-between py-2.5">
                      <dt className="text-xs text-muted-foreground">{spec.label}</dt>
                      <dd className="text-xs font-semibold text-foreground">{spec.value}</dd>
                    </div>
                  ))}
                </dl>

                <button
                  onClick={() => onModelClick?.(model.id)}
                  className={`mt-6 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                    model.badge === "Flagship"
                      ? "bg-foreground text-background hover:opacity-90"
                      : "border border-white/12 text-white/50 cursor-default"
                  }`}
                  disabled={model.badge !== "Flagship"}
                >
                  {model.badge === "Flagship" ? "Try R1" : "Coming soon"}
                  {model.badge === "Flagship" && (
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
