"use client"

import { Sun, Target, GraduationCap, Volume2, VolumeX, X } from "lucide-react"

export type FocusLevel = "light" | "deep" | "study"

const LEVELS: { id: FocusLevel; label: string; icon: typeof Sun; hint: string }[] = [
  { id: "light", label: "Light", icon: Sun, hint: "Normal, fewer distractions" },
  { id: "deep", label: "Deep", icon: Target, hint: "Short, no-fluff answers" },
  { id: "study", label: "Study", icon: GraduationCap, hint: "Coach mode + timer" },
]

// The floating control shown while focus mode is active: choose a focus level and
// toggle the ambient soundscape. Kept minimal so it doesn't break the calm.
export function FocusBar({
  level,
  onLevel,
  ambientOn,
  onAmbient,
  onExit,
}: {
  level: FocusLevel
  onLevel: (l: FocusLevel) => void
  ambientOn: boolean
  onAmbient: () => void
  onExit: () => void
}) {
  return (
    <div className="pointer-events-auto fixed left-1/2 top-5 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="liquid-glass liquid-glass-soft flex items-center gap-1 rounded-full p-1 pl-1.5 shadow-xl">
        <span className="px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Focus</span>

        <div className="flex items-center gap-0.5 rounded-full bg-white/[0.04] p-0.5">
          {LEVELS.map((l) => {
            const Icon = l.icon
            const active = level === l.id
            return (
              <button
                key={l.id}
                onClick={() => onLevel(l.id)}
                title={l.hint}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-white text-black" : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-3.5" />
                {l.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={onAmbient}
          title={ambientOn ? "Mute ambient sound" : "Play ambient sound"}
          aria-pressed={ambientOn}
          className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${
            ambientOn ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"
          }`}
        >
          {ambientOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>

        <button
          onClick={onExit}
          title="Exit focus mode"
          className="inline-flex size-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
