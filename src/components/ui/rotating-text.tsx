"use client"

import { useEffect, useState } from "react"

interface RotatingTextProps {
  words?: string[]
  interval?: number
  className?: string
}

export function RotatingText({
  words = ["distilled", "pure", "simple", "genuine", "casual", "honest", "effortless"],
  interval = 2200,
  className = "",
}: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      // fade/slide current word out
      setVisible(false)
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length)
        // bring next word in
        setVisible(true)
      }, 350)
      return () => clearTimeout(t)
    }, interval)
    return () => clearInterval(id)
  }, [interval, words.length])

  const widest = words.reduce((a, b) => (b.length > a.length ? b : a), "")

  return (
    <span className="relative inline-flex overflow-hidden align-bottom leading-[1.3]">
      {/* sizer reserves space for the widest word so the line never jumps */}
      <span className={`invisible ${className}`} aria-hidden>
        {widest}
      </span>
      <span
        aria-live="polite"
        className={`absolute inset-0 flex items-baseline justify-start whitespace-nowrap transition-all duration-[350ms] ease-out ${className} ${
          visible
            ? "translate-y-0 opacity-100 blur-0"
            : "-translate-y-1/2 opacity-0 blur-[6px]"
        }`}
      >
        {words[index]}
      </span>
    </span>
  )
}
