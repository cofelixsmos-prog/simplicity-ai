"use client"

import { useEffect, useState } from "react"

// Playful, slightly-slanted status word shown while Vordex is fusing — replaces
// the raw step list with something that reads like the model is mulling it over.
const WORDS = [
  "wondering", "hmm", "debating", "thinking", "thinking hard", "pondering",
  "second-guessing", "reconsidering", "arguing with itself", "mulling",
  "weighing it", "hmm hmm", "cross-examining", "reconciling", "deliberating",
  "poking holes", "on the fence", "squinting at it", "nearly there",
]

export function FusionThinking() {
  const [i, setI] = useState(0)

  useEffect(() => {
    // Wander through the words at a slightly irregular, human cadence.
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setI(() => Math.floor(Math.random() * WORDS.length))
      timer = setTimeout(tick, 2200 + Math.random() * 1200)
    }
    timer = setTimeout(tick, 1400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex items-center gap-2 pt-1">
      <span
        key={i}
        className="fusion-word select-none text-[12.5px] font-light tracking-tight text-white/50"
      >
        {WORDS[i]}…
      </span>
      <style>{`
        @keyframes fusionWordIn {
          from { opacity: 0; transform: skewX(-1.5deg) translateY(2px); }
          to   { opacity: 1; transform: skewX(-1.5deg) translateY(0); }
        }
        .fusion-word { animation: fusionWordIn 0.3s ease-out; display: inline-block; transform: skewX(-1.5deg); }
      `}</style>
    </div>
  )
}
