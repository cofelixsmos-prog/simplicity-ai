"use client"

import { useEffect, useRef, useState } from "react"

// A dimmed night-meadow hero that occupies ~1/3 of the viewport and drifts with
// a gentle parallax as you scroll. Recreated in CSS (a night sky, a soft moon
// glow, a dark meadow silhouette, and drifting fireflies) so it needs no asset
// and stays crisp — the same calm night mood, dimmed.
export function BenchHero({ title, tagline }: { title: string; tagline: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setOffset(window.scrollY))
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Fixed set of fireflies (stable positions).
  const flies = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37) % 100,
    top: 40 + ((i * 53) % 55),
    delay: (i % 8) * 0.7,
    size: 1 + (i % 3),
  }))

  return (
    <div ref={ref} className="relative h-[38vh] min-h-[280px] w-full overflow-hidden">
      {/* night sky — parallax slower than scroll */}
      <div
        className="absolute inset-x-0 top-0 h-[130%]"
        style={{
          transform: `translateY(${offset * 0.3}px)`,
          background:
            "linear-gradient(180deg,#05060a 0%,#0a0d16 40%,#0d1119 62%,#0a0f0c 100%)",
        }}
      >
        {/* moon glow */}
        <div
          className="absolute left-[8%] top-[52%] size-40 rounded-full"
          style={{ background: "radial-gradient(circle,rgba(180,200,240,0.35),transparent 70%)", filter: "blur(6px)" }}
        />
        {/* soft clouds */}
        <div className="absolute inset-x-0 top-[12%] h-24 opacity-40" style={{ background: "radial-gradient(60% 100% at 40% 50%,rgba(120,130,160,0.25),transparent)" }} />
      </div>

      {/* meadow silhouette — parallax faster */}
      <div
        className="absolute inset-x-0 bottom-0 h-[45%]"
        style={{
          transform: `translateY(${offset * 0.08}px)`,
          background: "linear-gradient(180deg,transparent,#060a07 45%,#04070a 100%)",
        }}
      />

      {/* fireflies */}
      {flies.map((f, i) => (
        <span
          key={i}
          className="bench-firefly absolute rounded-full bg-white/70"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.size,
            height: f.size,
            animationDelay: `${f.delay}s`,
            transform: `translateY(${offset * 0.05}px)`,
          }}
        />
      ))}

      {/* dim scrim so text is legible */}
      <div className="absolute inset-0 bg-black/35" />

      {/* title */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl [text-shadow:0_2px_30px_rgba(0,0,0,0.6)]">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/70 [text-shadow:0_1px_16px_rgba(0,0,0,0.6)]">
          {tagline}
        </p>
      </div>
    </div>
  )
}
