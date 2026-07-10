"use client"

import { useEffect, useRef } from "react"

// A gentle, generated focus soundscape — soft filtered noise (a calm rain / airy
// hush) synthesized with the Web Audio API, so it needs no audio files and loops
// forever. Mount with `on` to play; it fades in/out and cleans itself up.
export function AmbientSound({ on, volume = 0.12 }: { on: boolean; volume?: number }) {
  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const srcRef = useRef<AudioBufferSourceNode | null>(null)

  useEffect(() => {
    if (!on) return

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ctxRef.current = ctx

    // ~2s of brown noise (softer, deeper than white) in a looping buffer.
    const frames = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < frames; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true

    // Lowpass takes the harsh edge off → a warm, rain-like hush.
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 780

    // Slow amplitude drift so it breathes instead of sitting flat.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.03

    const gain = ctx.createGain()
    gain.gain.value = 0
    gainRef.current = gain

    src.connect(lp).connect(gain).connect(ctx.destination)
    lfo.connect(lfoGain).connect(gain.gain)

    src.start()
    lfo.start()
    srcRef.current = src
    // fade in
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2)

    return () => {
      const g = gainRef.current
      const c = ctxRef.current
      try {
        if (g && c) g.gain.linearRampToValueAtTime(0, c.currentTime + 0.4)
        setTimeout(() => {
          try {
            src.stop()
          } catch {}
          c?.close().catch(() => {})
        }, 500)
      } catch {}
    }
  }, [on, volume])

  return null
}
