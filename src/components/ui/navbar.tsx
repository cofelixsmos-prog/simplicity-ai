"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"

interface NavLink {
  label: string
  href: string
}

interface NavbarProps {
  brand?: string
  links?: NavLink[]
  ctaText?: string
  ctaHref?: string
  onCtaClick?: () => void
}

const defaultLinks: NavLink[] = [
  { label: "Models", href: "/#models" },
  { label: "Developers", href: "/developers" },
  { label: "Resources", href: "/resources" },
  { label: "Company", href: "/#company" },
]

export function Navbar({
  brand = "Simplicity",
  links = defaultLinks,
  ctaText = "Get early access",
  ctaHref = "/chat",
  onCtaClick,
}: NavbarProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-5 inset-x-0 z-50 flex justify-center px-4">
      <nav className="w-full max-w-5xl rounded-full border border-white/10 bg-black/30 backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_16px_48px_-12px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-4 duration-700 ease-out">
        <div className="flex items-center justify-between pl-6 pr-2.5 py-2.5">
          {/* Brand */}
          <a
            href="/"
            className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-white"
          >
            <span className="size-1.5 rounded-full bg-white/80" />
            {brand}
          </a>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-9">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="inline-block text-[13.5px] font-medium tracking-wide text-white/60 transition-all duration-200 hover:-translate-y-px hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop CTA */}
          {onCtaClick ? (
            <button
              onClick={onCtaClick}
              className="hidden md:inline-flex items-center rounded-full bg-white px-5 py-2 text-[13.5px] font-medium text-black transition-all duration-300 hover:bg-white/90 hover:shadow-[0_0_24px_-4px_rgba(255,255,255,0.5)]"
            >
              {ctaText}
            </button>
          ) : (
            <a
              href={ctaHref}
              className="hidden md:inline-flex items-center rounded-full bg-white px-5 py-2 text-[13.5px] font-medium text-black transition-all duration-300 hover:bg-white/90 hover:shadow-[0_0_24px_-4px_rgba(255,255,255,0.5)]"
            >
              {ctaText}
            </a>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-white transition-colors hover:bg-white/10"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-white/10 px-5 py-4">
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            {onCtaClick ? (
              <button
                onClick={() => {
                  setOpen(false)
                  onCtaClick()
                }}
                className="mt-3 w-full rounded-full border border-white/20 bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/25"
              >
                {ctaText}
              </button>
            ) : (
              <a
                href={ctaHref}
                onClick={() => setOpen(false)}
                className="mt-3 block w-full rounded-full border border-white/20 bg-white/15 px-5 py-2.5 text-center text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/25"
              >
                {ctaText}
              </a>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
