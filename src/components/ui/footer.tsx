"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface FooterProps {
  brand?: string
}

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Features",
    links: [
      { label: "Focus mode", href: "/features/focus-mode" },
      { label: "Agent swarm", href: "/features/agent-swarm" },
      { label: "Gmail integration", href: "/features/gmail-integration" },
      { label: "Document generation", href: "/features/document-generation" },
    ],
  },
  {
    heading: "For",
    links: [
      { label: "Students", href: "/for/students" },
      { label: "Writers", href: "/for/writers" },
      { label: "Researchers", href: "/for/researchers" },
      { label: "Developers", href: "/developers" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Companies", href: "/companies" },
      { label: "Bench Labs", href: "/bench-labs" },
      { label: "Partners", href: "/partners" },
      { label: "Resources", href: "/resources" },
      { label: "Early access", href: "/register" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
]

export function Footer({ brand = "Simplicity" }: FooterProps) {
  const footerRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const footer = footerRef.current
    const grid = gridRef.current
    const bottom = bottomRef.current
    if (!footer || !grid || !bottom) return

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) return

    const ctx = gsap.context(() => {
      // each column slides up from below
      gsap.from(grid.children, {
        y: 50,
        opacity: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: grid,
          start: "top 90%",
          once: true,
        },
      })

      // bottom bar slides up
      gsap.from(bottom, {
        y: 30,
        opacity: 0,
        duration: 0.6,
        delay: 0.3,
        ease: "power2.out",
        scrollTrigger: {
          trigger: bottom,
          start: "top 95%",
          once: true,
        },
      })
    }, footer)

    return () => ctx.revert()
  }, [])

  return (
    <footer ref={footerRef} id="company" className="relative z-10 w-full border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div ref={gridRef} className="grid gap-12 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          {/* brand block */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-foreground">
              <span className="size-1.5 rounded-full bg-white/80" />
              {brand}
            </Link>
            <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
              Intelligence without complexity. One calm assistant that focuses, remembers, and builds.
            </p>
          </div>

          {/* link columns */}
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">{col.heading}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <a href={l.href} className="text-sm text-white/60 transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div ref={bottomRef} className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-8 sm:flex-row">
          <p className="text-xs text-white/35">&copy; {new Date().getFullYear()} {brand}. All rights reserved.</p>
          <p className="flex items-center gap-1.5 text-xs text-white/35">
            Made in India <span aria-hidden>&#127470;&#127475;</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
