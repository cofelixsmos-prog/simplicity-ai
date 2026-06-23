"use client"

import { useEffect, useState } from "react"

// Cycles: "Made in China" → strikes through China → reveals "Made in India".
export function MadeIn() {
  // 0 = China shown, 1 = China struck through, 2 = India revealed
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    const run = () => {
      setStage(0)
      timers.push(setTimeout(() => setStage(1), 1400)) // strike China
      timers.push(setTimeout(() => setStage(2), 2200)) // reveal India
    }

    run()
    const loop = setInterval(run, 6000)
    return () => {
      clearInterval(loop)
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium tracking-wide text-white/60">
      <span>Made in</span>
      <span className="relative inline-flex items-center">
        {/* sizer reserves space for the wider word so nothing clips or shifts */}
        <span className="invisible font-semibold whitespace-nowrap" aria-hidden>
          India 🇮🇳
        </span>

        {/* China — struck through, then fades out */}
        <span
          className={`absolute left-0 transition-all duration-500 ease-out ${
            stage === 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="relative text-white/80">
            China
            <span
              className={`absolute left-0 top-1/2 h-px bg-red-400 transition-all duration-300 ease-out ${
                stage >= 1 ? "w-full" : "w-0"
              }`}
            />
          </span>
        </span>

        {/* India — fades/slides in */}
        <span
          className={`absolute left-0 whitespace-nowrap font-semibold text-white transition-all duration-500 ease-out ${
            stage === 2
              ? "translate-y-0 opacity-100 blur-0"
              : "translate-y-1 opacity-0 blur-[3px]"
          }`}
        >
          India 🇮🇳
        </span>
      </span>
    </span>
  )
}
