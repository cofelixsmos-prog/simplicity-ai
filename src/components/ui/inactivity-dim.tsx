"use client"

import { useEffect, useRef, useState } from "react"

// Dims the whole screen after a period of no interaction, then snaps back the
// instant the user moves/types/scrolls. Purely a calming visual — it's
// pointer-events-none, so it never blocks anything. Deeper dim in focus mode.
export function InactivityDim({ seconds = 15, focus = false }: { seconds?: number; focus?: boolean }) {
  const [idle, setIdle] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const arm = () => {
      setIdle(false)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setIdle(true), seconds * 1000)
    }
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"]
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    // Pause the timer while the tab is hidden; re-arm when it's visible again.
    const onVis = () => (document.visibilityState === "hidden" ? setIdle(false) : arm())
    document.addEventListener("visibilitychange", onVis)
    arm()
    return () => {
      events.forEach((e) => window.removeEventListener(e, arm))
      document.removeEventListener("visibilitychange", onVis)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [seconds])

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[150] bg-black transition-opacity duration-[1400ms] ease-out ${
        idle ? (focus ? "opacity-65" : "opacity-45") : "opacity-0"
      }`}
    />
  )
}
