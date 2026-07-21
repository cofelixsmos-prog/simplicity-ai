"use client"

import { useState } from "react"
import { Download, Presentation, Loader2 } from "lucide-react"
import {
  buildPptx,
  parsePpt as parsePptShared,
  pptFileName,
  resolveTheme,
  type PptSlide as Slide,
  type PptLayout as Layout,
  type PptSpec,
  type PptTheme as Theme,
} from "@/lib/ppt"

export type { PptSpec } from "@/lib/ppt"

// Re-exported so existing importers keep working; the real parser (with input
// sanitizing) lives in lib/ppt.ts and is shared with the server renderer.
export const parsePpt = parsePptShared

// ── Live preview thumbnails (theme-aware, one per layout) ───────────────────
function hx(h: string) {
  return `#${h}`
}

function SlideThumb({ slide, index, theme }: { slide: Slide; index: number; theme: Theme }) {
  const layout: Layout = slide.layout ?? (index === 0 ? "title" : "content")
  const base = "relative aspect-video w-full overflow-hidden rounded-lg border"

  if (layout === "title") {
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: hx(theme.accent) }} />
        <div className="flex h-full flex-col justify-center px-4 pl-5">
          {slide.eyebrow && (
            <p className="text-[7px] font-semibold tracking-widest" style={{ color: hx(theme.accent) }}>
              {slide.eyebrow.toUpperCase()}
            </p>
          )}
          <div className="my-1 h-1 w-8 rounded-full" style={{ background: hx(theme.accent) }} />
          <p className="text-[13px] font-bold leading-tight" style={{ color: hx(theme.text) }}>
            {slide.title}
          </p>
          {slide.subtitle && (
            <p className="mt-1 text-[9px]" style={{ color: hx(theme.muted) }}>
              {slide.subtitle}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (layout === "section" || layout === "closing") {
    return (
      <div className={base} style={{ background: hx(theme.accent), borderColor: hx(theme.accent) }}>
        <div className="flex h-full flex-col justify-center px-4 text-white">
          {slide.eyebrow && <p className="text-[8px] font-semibold tracking-widest opacity-80">{slide.eyebrow}</p>}
          <p className="mt-0.5 text-[13px] font-bold leading-tight">{slide.title}</p>
          {slide.subtitle && <p className="mt-1 text-[8px] opacity-80">{slide.subtitle}</p>}
        </div>
      </div>
    )
  }

  if (layout === "metrics") {
    const metrics = (slide.metrics ?? []).slice(0, 4)
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col p-3">
          <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
            {slide.title}
          </p>
          <div className="mt-auto flex items-stretch gap-1.5">
            {metrics.map((m, i) => (
              <div
                key={i}
                className="min-w-0 flex-1 overflow-hidden rounded"
                style={{ background: hx(theme.panel) }}
              >
                <div className="h-0.5 w-full" style={{ background: hx(theme.accent) }} />
                <div className="p-1.5">
                  <p className="truncate text-[13px] font-bold leading-none" style={{ color: hx(theme.accent) }}>
                    {m.value}
                  </p>
                  <p className="mt-0.5 truncate text-[6px]" style={{ color: hx(theme.muted) }}>
                    {m.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (layout === "quote") {
    return (
      <div className={base} style={{ background: hx(theme.panel), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col justify-center px-4">
          <span className="font-serif text-[20px] leading-none" style={{ color: hx(theme.accent) }}>
            &ldquo;
          </span>
          <p className="line-clamp-3 text-[10px] font-medium leading-snug" style={{ color: hx(theme.text) }}>
            {slide.quote}
          </p>
          {slide.attribution && (
            <p className="mt-1 text-[8px]" style={{ color: hx(theme.muted) }}>
              — {slide.attribution}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (layout === "columns") {
    const cols = (slide.columns ?? []).slice(0, 2)
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col p-3">
          <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
            {slide.title}
          </p>
          <div className="mt-2 grid flex-1 grid-cols-2 gap-2">
            {cols.map((c, i) => (
              <div key={i}>
                <p className="text-[8px] font-semibold" style={{ color: hx(theme.accent) }}>
                  {c.heading}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {c.bullets.slice(0, 3).map((b, j) => (
                    <li key={j} className="truncate text-[7px]" style={{ color: hx(theme.muted) }}>
                      • {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (layout === "agenda") {
    const items = (slide.items ?? slide.bullets ?? []).slice(0, 5)
    return (
      <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
        <div className="flex h-full flex-col p-3">
          <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
            {slide.title ?? "Agenda"}
          </p>
          <ul className="mt-2 space-y-1">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  className="flex size-3 items-center justify-center rounded-full text-[6px] font-bold text-white"
                  style={{ background: hx(theme.accent) }}
                >
                  {i + 1}
                </span>
                <span className="truncate text-[8px]" style={{ color: hx(theme.muted) }}>
                  {it}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // content (with optional chart)
  return (
    <div className={base} style={{ background: hx(theme.bg), borderColor: hx(theme.line) }}>
      <div className="flex h-full flex-col p-3">
        {slide.eyebrow && (
          <p className="text-[6px] font-semibold tracking-widest" style={{ color: hx(theme.accent) }}>
            {slide.eyebrow.toUpperCase()}
          </p>
        )}
        <p className="text-[10px] font-bold" style={{ color: hx(theme.text) }}>
          {slide.title}
        </p>
        <div className="mt-1 h-0.5 w-6 rounded-full" style={{ background: hx(theme.accent) }} />
        <div className="mt-2 flex flex-1 gap-2">
          <ul className="flex-1 space-y-1">
            {(slide.bullets ?? []).slice(0, 5).map((b, i) => (
              <li key={i} className="flex gap-1 text-[8px] leading-snug" style={{ color: hx(theme.muted) }}>
                <span style={{ color: hx(theme.accent) }}>▪</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
          {slide.chart && (
            <div className="flex w-1/3 items-end gap-0.5">
              {(slide.chart.datasets[0]?.data ?? []).slice(0, 6).map((v, i, arr) => {
                const max = Math.max(...arr, 1)
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${(v / max) * 100}%`, background: hx(theme.accent) }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PptBlock({
  code,
  streaming = false,
  compact = false,
}: {
  code: string
  streaming?: boolean
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const spec = parsePpt(code)

  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Designing presentation…
      </div>
    )
  }
  if (!spec) return null

  const theme = resolveTheme(spec)

  const download = async () => {
    setBusy(true)
    try {
      // Same builder the server uses, so the downloaded deck matches the file
      // create_ppt produces for email/Drive.
      const pptx = await buildPptx(spec)
      await pptx.writeFile({ fileName: pptFileName(spec) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="my-4 rounded-xl border border-border bg-[#0b0b0c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Presentation className="size-4 text-white/70" />
          <span className="text-sm font-medium text-white">{spec.title ?? "Presentation"}</span>
          <span className="text-xs text-white/40">· {spec.slides.length} slides</span>
        </div>
        <button
          onClick={download}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          .pptx
        </button>
      </div>
      <div className={`grid gap-3 ${compact ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2"}`}>
        {spec.slides.map((s, i) => (
          <SlideThumb key={i} slide={s} index={i} theme={theme} />
        ))}
      </div>
    </div>
  )
}
