"use client"

import { useEffect, useRef } from "react"
import { ArrowUpRight } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function PartnersSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const linkRef = useRef<HTMLDivElement>(null)
  const hexRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const heading = headingRef.current
    const card = cardRef.current
    const link = linkRef.current
    const hex = hexRef.current
    if (!section || !heading || !card || !link || !hex) return

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) return

    const ctx = gsap.context(() => {
      // heading elements slide vertically with stagger
      gsap.from(heading.children, {
        y: 70,
        opacity: 0,
        rotateX: 12,
        stagger: 0.12,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: heading,
          start: "top 85%",
          once: true,
        },
      })

      // card flips in from the right
      gsap.from(card, {
        x: 160,
        rotateY: 20,
        opacity: 0,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 85%",
          once: true,
        },
      })

      // hex decoration rotates and floats
      gsap.to(hex, {
        rotation: 180,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 2,
        },
      })

      gsap.fromTo(
        hex,
        { y: 60 },
        {
          y: -60,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        }
      )

      // bottom link slides up
      gsap.from(link, {
        y: 40,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: link,
          start: "top 92%",
          once: true,
        },
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative z-10 w-full overflow-hidden bg-background px-6 py-28 sm:py-40">
      {/* rotating hex decoration */}
      <svg
        ref={hexRef}
        className="pointer-events-none absolute left-[-5%] top-[30%] size-[400px] text-white/[0.025] sm:size-[500px]"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden
      >
        <polygon points="100,10 180,55 180,145 100,190 20,145 20,55" stroke="currentColor" strokeWidth="0.4" />
        <polygon points="100,35 155,62 155,138 100,165 45,138 45,62" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3 5" />
        <polygon points="100,60 130,77 130,123 100,140 70,123 70,77" stroke="currentColor" strokeWidth="0.4" />
      </svg>

      <div className="relative mx-auto max-w-5xl">
        <div ref={headingRef} className="mb-16" style={{ perspective: "600px" }}>
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

        <div ref={cardRef} className="grid gap-5 sm:grid-cols-2" style={{ perspective: "800px" }}>
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
            <div className="flex h-full flex-col gap-6">
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
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Visit <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
            <div className="flex h-full flex-col gap-6">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-foreground">Bench Labs</h3>
                <p className="mt-2 text-sm font-medium text-white/60">
                  Open Source Benchmarks & AI Research
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                  Building open source benchmarks, datasets, experiments, research and AI —
                  designed to be explored, reproduced, improved, and shared by the community.
                </p>
              </div>
              <a
                href="https://huggingface.co/spaces/bench-labs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Visit <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div ref={linkRef} className="mt-10 text-center">
          <a
            href="/partners"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Explore all partners <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
