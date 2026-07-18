"use client"

import { useEffect, useRef } from "react"
import { ArrowRight } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function CtaSection({ onCtaClick }: { onCtaClick?: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const section = ref.current
    const card = cardRef.current
    const ring = ringRef.current
    if (!section || !card || !ring) return

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) return

    const ctx = gsap.context(() => {
      // card slides up and scales from below
      gsap.from(card, {
        y: 120,
        opacity: 0,
        scale: 0.88,
        rotateX: 8,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 92%",
          once: true,
        },
      })

      // inner elements slide up vertically with stagger
      gsap.from(card.querySelectorAll(".cta-el"), {
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 80%",
          once: true,
        },
      })

      // ring rotates forever
      gsap.to(ring, {
        rotation: 360,
        duration: 40,
        repeat: -1,
        ease: "none",
      })

      // ring parallax
      gsap.fromTo(
        ring,
        { y: 50 },
        {
          y: -50,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        }
      )
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} className="relative z-10 w-full overflow-hidden bg-background px-6 pb-32 pt-8 sm:pb-40">
      <div className="mx-auto max-w-5xl">
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-8 py-16 text-center sm:px-16 sm:py-20"
          style={{ perspective: "800px", transformStyle: "preserve-3d" }}
        >
          {/* glow */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07] blur-3xl" />

          {/* rotating ring behind text */}
          <svg
            ref={ringRef}
            className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 text-white/[0.04] sm:size-[550px]"
            viewBox="0 0 200 200"
            fill="none"
            aria-hidden
          >
            <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.3" />
            <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 8" />
            <circle cx="100" cy="5" r="2.5" fill="currentColor" />
            <circle cx="5" cy="100" r="1.5" fill="currentColor" />
            <circle cx="195" cy="100" r="1.5" fill="currentColor" />
          </svg>

          <h2 className="cta-el relative mx-auto max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            Think clearer.
            <br />
            <span className="text-white/45">Ship faster. Stay calm.</span>
          </h2>
          <p className="cta-el relative mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Simplicity R1 is free during early access. No card, no queue — just sign up and start.
          </p>
          <button
            onClick={onCtaClick}
            className="cta-el group relative mt-10 inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-[15px] font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_44px_-6px_rgba(255,255,255,0.55)]"
          >
            Get early access
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
