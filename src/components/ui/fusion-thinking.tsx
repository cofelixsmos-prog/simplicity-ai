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
      timer = setTimeout(tick, 900 + Math.random() * 700)
    }
    timer = setTimeout(tick, 700)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="size-2 animate-pulse rounded-full bg-white/50" />
      <span
        key={i}
        className="fusion-word select-none text-[15px] italic text-white/55"
        style={{ transform: "skewX(-8deg)" }}
      >
        {WORDS[i]}…
      </span>
      <style>{`
        @keyframes fusionWordIn {
          from { opacity: 0; transform: skewX(-8deg) translateY(3px); }
          to   { opacity: 1; transform: skewX(-8deg) translateY(0); }
        }
        .fusion-word { animation: fusionWordIn 0.35s ease-out; display: inline-block; }
      `}</style>
    </div>
  )
}
