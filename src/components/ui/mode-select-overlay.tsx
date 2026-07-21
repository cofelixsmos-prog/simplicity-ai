"use client"

import { Sparkles, FlaskConical, Box, Share2 } from "lucide-react"

export type WorkMode = "general" | "deep-research" | "studio" | "harness"

export function ModeSelectOverlay({ onSelect }: { onSelect: (mode: WorkMode) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/45 px-4 backdrop-blur-3xl backdrop-saturate-150">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_12%,rgba(255,255,255,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_60px_rgba(0,0,0,0.42)]" />

      <div className="relative flex w-full max-w-[780px] flex-col items-center gap-8 text-center">
        <div className="anim-fade" style={{ ["--delay" as string]: "80ms" }}>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            What are you working on?
          </h1>
          <p className="mt-2 text-[15px] text-white/50">Pick a mode to get started — you can switch anytime.</p>
        </div>

        <div className="anim-fade grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ ["--delay" as string]: "200ms" }}>
          {/* General work */}
          <button
            type="button"
            onClick={() => onSelect("general")}
            className="group liquid-glass liquid-glass-soft glass-panel flex flex-col items-start gap-3 p-6 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
              <Sparkles className="size-4.5 text-white/80" strokeWidth={1.6} />
            </span>
            <span className="text-lg font-semibold text-white">General work</span>
            <span className="text-[13.5px] leading-relaxed text-white/50">
              Everyday reasoning, writing, code, and deliverables — the full Simplicity experience.
            </span>
          </button>

          {/* Studio */}
          <button
            type="button"
            onClick={() => onSelect("studio")}
            className="group liquid-glass liquid-glass-soft glass-panel flex flex-col items-start gap-3 p-6 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
              <Box className="size-4.5 text-white/80" strokeWidth={1.6} />
            </span>
            <span className="text-lg font-semibold text-white">Studio</span>
            <span className="text-[13.5px] leading-relaxed text-white/50">
              Build 2D and 3D objects on a live canvas — cars, buildings, floor plans, anything.
            </span>
          </button>

          {/* Harness — autonomous orchestration (invite-only) */}
          <button
            type="button"
            onClick={() => onSelect("harness")}
            className="group liquid-glass liquid-glass-soft glass-panel relative flex flex-col items-start gap-3 p-6 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="absolute top-4 right-4 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70">
              Invite
            </span>
            <span className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
              <Share2 className="size-4.5 text-white/80" strokeWidth={1.6} />
            </span>
            <span className="text-lg font-semibold text-white">Harness</span>
            <span className="text-[13.5px] leading-relaxed text-white/50">
              Give one objective. An executive AI spawns specialist agents to plan, build, verify, and deliver.
            </span>
          </button>

          {/* Deep research — coming soon */}
          <div className="liquid-glass liquid-glass-soft glass-panel relative flex cursor-default flex-col items-start gap-3 p-6 text-left opacity-60">
            <span className="absolute top-4 right-4 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70">
              Coming soon
            </span>
            <span className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
              <FlaskConical className="size-4.5 text-white/60" strokeWidth={1.6} />
            </span>
            <span className="text-lg font-semibold text-white/80">Deep research</span>
            <span className="text-[13.5px] leading-relaxed text-white/45">
              Grounded, multi-source research with citations — coming soon.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
