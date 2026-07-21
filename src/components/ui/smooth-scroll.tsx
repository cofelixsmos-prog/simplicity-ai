"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Lenis from "lenis"

// App-wide smooth scrolling for the marketing / content pages. Chat and Studio
// run as fixed h-dvh viewports with their OWN inner scroll containers, so Lenis
// must not run there — it would hijack the wheel and fight those containers.
// We gate on pathname and only drive window scroll on the scrolling routes.
const FIXED_VIEWPORT_PREFIXES = ["/chat", "/studio", "/harness"]

export function SmoothScroll() {
  const pathname = usePathname()

  useEffect(() => {
    // Skip entirely on fixed-viewport app routes.
    if (FIXED_VIEWPORT_PREFIXES.some((p) => pathname.startsWith(p))) return
    // Respect reduced-motion — no inertia for users who asked for less motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({
      duration: 1.05, // the gentle "catch up" delay — smooth but not sluggish
      easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic — fast start, soft settle
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      // Any element (or descendant) marked data-lenis-prevent keeps native scroll
      // — dropdowns, modals, code panels, etc.
      prevent: (node) => node.hasAttribute?.("data-lenis-prevent"),
    })

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [pathname])

  return null
}
