"use client"

import { useEffect, useState } from "react"
import { Moon } from "lucide-react"

// Evening wind-down. After 6pm, the first time you open Simplicity that day, it
// offers Night mode. The warmth itself lives in the background shader (an amber
// gradient layer that cross-fades into the animation — see shader-background);
// this component only owns the state, the invitation, and a whisper of flat dim
// so the UI chrome quiets down too. The ask resets daily; the choice persists.
const KEY_ON = "sx-night"
const KEY_ASKED = "sx-night-asked"
const todayStr = () => new Date().toISOString().slice(0, 10)

function broadcast(on: boolean) {
  window.dispatchEvent(new CustomEvent("night-changed", { detail: on }))
}

export function NightMode() {
  const [on, setOn] = useState(false)
  const [ask, setAsk] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let enabled = false
    try {
      enabled = localStorage.getItem(KEY_ON) === "1"
      const hour = new Date().getHours()
      // Auto-reset between 6am and 6pm — night is over
      if (enabled && hour >= 6 && hour < 18) {
        localStorage.setItem(KEY_ON, "0")
        enabled = false
      }
      setOn(enabled)
      const evening = hour >= 18
      const askedToday = localStorage.getItem(KEY_ASKED) === todayStr()
      if (evening && !enabled && !askedToday) setAsk(true)
    } catch {
      /* storage unavailable */
    }

    const toggle = () =>
      setOn((v) => {
        const nv = !v
        try {
          localStorage.setItem(KEY_ON, nv ? "1" : "0")
        } catch {}
        broadcast(nv)
        return nv
      })
    window.addEventListener("toggle-night", toggle)
    return () => window.removeEventListener("toggle-night", toggle)
  }, [])

  const dismiss = (enable: boolean) => {
    setLeaving(true)
    setTimeout(() => {
      setAsk(false)
      setLeaving(false)
    }, 450)
    try {
      localStorage.setItem(KEY_ASKED, todayStr())
      if (enable) localStorage.setItem(KEY_ON, "1")
    } catch {}
    if (enable) {
      setOn(true)
      broadcast(true)
    }
  }

  return (
    <>
      {/* A flat, uniform quieting of the UI — no shape, no hotspot. The color
          itself comes from the shader's night layer underneath. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-[200] bg-[#140f0a] transition-opacity duration-[2400ms] ease-out ${
          on ? "opacity-[0.08]" : "opacity-0"
        }`}
      />

      {/* Once-a-night invitation — centered, quiet, unhurried */}
      {ask && (
        <div
          className={`fixed inset-0 z-[210] flex items-center justify-center px-6 transition-opacity duration-[450ms] ease-out ${
            leaving ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* dim veil behind the card */}
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-700"
            onClick={() => dismiss(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Enable Night mode"
            className="glass-in liquid-glass liquid-glass-soft glass-panel relative w-[min(90vw,400px)] p-10 text-center"
          >
            <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <Moon className="size-5 text-amber-200/80" strokeWidth={1.5} />
            </span>
            <h3 className="mt-6 text-[22px] font-semibold tracking-tight text-white">
              Good evening
            </h3>
            <p className="mx-auto mt-2.5 max-w-[280px] text-[14px] leading-relaxed text-white/55">
              It&apos;s past six. Night warms the light and quiets the room — easier on the eyes.
            </p>
            <div className="mt-8 space-y-2.5">
              <button
                onClick={() => dismiss(true)}
                className="w-full rounded-full bg-white py-3 text-[14px] font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99]"
              >
                Turn on Night
              </button>
              <button
                onClick={() => dismiss(false)}
                className="w-full rounded-full py-2.5 text-[13px] font-medium text-white/45 transition-colors hover:text-white"
              >
                Not tonight
              </button>
            </div>
            <p className="mt-6 text-[11px] tracking-wide text-white/30">
              Anytime from ⌘K · resets each evening
            </p>
          </div>
        </div>
      )}
    </>
  )
}
