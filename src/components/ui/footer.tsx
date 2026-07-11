"use client"

import Link from "next/link"
import { Reveal } from "@/components/ui/reveal"

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
      { label: "Resources", href: "/resources" },
      { label: "Early access", href: "/register" },
      { label: "Sign in", href: "/login" },
    ],
  },
]

export function Footer({ brand = "Simplicity" }: FooterProps) {
  return (
    <footer id="company" className="relative z-10 w-full border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
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
        </Reveal>

        <Reveal delay={120} className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-8 sm:flex-row">
          <p className="text-xs text-white/35">© {new Date().getFullYear()} {brand}. All rights reserved.</p>
          <p className="flex items-center gap-1.5 text-xs text-white/35">
            Made in India <span aria-hidden>🇮🇳</span>
          </p>
        </Reveal>
      </div>
    </footer>
  )
}
