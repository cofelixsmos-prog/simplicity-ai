"use client"

// A considered first-paint screen — the "S" mark breathing on the deep
// background — shown while auth/data resolves, instead of a bare spinner.
export function Splash() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-5 bg-background">
      <span className="anim-float flex size-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <span className="text-2xl font-bold tracking-tight text-white">S</span>
      </span>
      <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.32em] text-white/35">
        <span className="size-1.5 animate-pulse rounded-full bg-white/40" />
        Simplicity
      </span>
    </div>
  )
}
