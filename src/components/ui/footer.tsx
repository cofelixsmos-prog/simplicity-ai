"use client"

import { Reveal } from "@/components/ui/reveal"

interface FooterProps {
  brand?: string
}

export function Footer({ brand = "Simplicity" }: FooterProps) {
  return (
    <footer
      id="company"
      className="relative z-10 w-full border-t border-border bg-background"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-14 sm:flex-row sm:justify-between">
        <Reveal className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground">
          <span className="size-1.5 rounded-full bg-white/80" />
          {brand}
        </Reveal>
      </div>
    </footer>
  )
}
