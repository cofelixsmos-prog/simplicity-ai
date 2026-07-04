"use client"

import { useEffect } from "react"
import { playClick } from "@/lib/sound"

// Places the press dimple exactly under the cursor by setting --gx/--gy on
// press-down. The dip + spring-back are handled purely in CSS (the --press /
// transform transition), so there's no scripted bounce.
//
// Also the app's single source of tactile audio: any tappable — button, link,
// menu item — emits one soft synthesized "tock" on press-down. Down, not up:
// the sound belongs to the finger landing, same as a physical key.
export function GlassPointer() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null

      const el = target?.closest?.(".liquid-glass") as HTMLElement | null
      if (el) {
        const r = el.getBoundingClientRect()
        el.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`)
        el.style.setProperty("--gy", `${((e.clientY - r.top) / r.height) * 100}%`)
      }

      if (target?.closest?.('button, a, [role="button"], [role="option"], [role="menuitem"]'))
        playClick()
    }
    window.addEventListener("pointerdown", onDown, { passive: true })
    return () => window.removeEventListener("pointerdown", onDown)
  }, [])

  return null
}
