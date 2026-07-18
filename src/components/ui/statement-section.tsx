"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function StatementSection() {
  const ref = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = ref.current
    const text = textRef.current
    const orb = orbRef.current
    if (!section || !text || !orb) return

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) return

    const words = text.querySelectorAll(".st-word")

    const ctx = gsap.context(() => {
      gsap.from(words, {
        opacity: 0.08,
        y: 20,
        rotateX: 40,
        stagger: 0.035,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: {
          trigger: section,
          start: "top 70%",
          end: "bottom 40%",
          scrub: 1,
        },
      })

      gsap.to(orb, {
        rotation: 360,
        scale: 1.3,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 2,
        },
      })

      gsap.fromTo(
        orb,
        { y: 100 },
        {
          y: -100,
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

  const dimText = "Most AI tools pile on features, tabs, and noise."
  const brightText = "Simplicity does the opposite — it clears everything away until only your work is left."

  return (
    <section ref={ref} className="relative z-10 w-full overflow-hidden bg-background px-6 py-28 sm:py-40">
      {/* rotating orb decoration */}
      <div
        ref={orbRef}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative size-[500px] sm:size-[700px]">
          <div className="absolute inset-0 rounded-full border border-white/[0.04]" />
          <div className="absolute inset-[15%] rounded-full border border-dashed border-white/[0.06]" />
          <div className="absolute inset-[35%] rounded-full border border-white/[0.03]" />
          <div className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-white/20" />
          <div className="absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white/15" />
          <div className="absolute left-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-white/10" />
        </div>
      </div>

      <div className="relative mx-auto max-w-4xl" style={{ perspective: "800px" }}>
        <p
          ref={textRef}
          className="text-balance text-3xl font-light leading-[1.3] tracking-tight sm:text-5xl sm:leading-[1.2]"
        >
          {dimText.split(" ").map((w, i) => (
            <span key={i} className="st-word inline-block text-white/35" style={{ transformOrigin: "center bottom" }}>
              {w}&nbsp;
            </span>
          ))}
          {brightText.split(" ").map((w, i) => (
            <span key={`b${i}`} className="st-word inline-block font-medium text-white" style={{ transformOrigin: "center bottom" }}>
              {w}&nbsp;
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
