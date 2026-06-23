"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

interface HeroSectionProps {
  eyebrow?: string
  title?: string
  highlightText?: string
  description?: string
  buttonText?: string
  onButtonClick?: () => void
  colors?: string[]
  distortion?: number
  swirl?: number
  speed?: number
  offsetX?: number
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  buttonClassName?: string
  maxWidth?: string
  veilOpacity?: string
  fontFamily?: string
  fontWeight?: number
}

export function HeroSection({
  eyebrow = "",
  title = "Intelligent AI Agents for",
  highlightText = "Smart Brands",
  description = "Transform your brand and evolve it through AI-driven brand guidelines and always up-to-date core components.",
  buttonText = "Join Waitlist",
  onButtonClick,
  colors = ["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"],
  distortion = 0.8,
  swirl = 0.6,
  speed = 0.42,
  offsetX = 0.08,
  className = "",
  titleClassName = "",
  descriptionClassName = "",
  buttonClassName = "",
  maxWidth = "max-w-6xl",
  veilOpacity = "bg-white/20 dark:bg-black/25",
  fontFamily = "var(--font-sans), Poppins, sans-serif",
  fontWeight = 600,
}: HeroSectionProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick()
    }
  }

  return (
    <section className={`relative w-full min-h-screen overflow-hidden bg-background flex items-center justify-center ${className}`}>
      <div className="fixed inset-0 w-screen h-screen">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={colors}
              distortion={distortion}
              swirl={swirl}
              grainMixer={0}
              grainOverlay={0}
              speed={speed}
              offsetX={offsetX}
            />
            <div className={`absolute inset-0 pointer-events-none ${veilOpacity}`} />
          </>
        )}
      </div>

      <div className={`relative z-10 ${maxWidth} mx-auto px-6 w-full`}>
        <div className="text-center">
          {eyebrow && (
            <div className="mb-7 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12.5px] font-medium tracking-wide text-white/80 backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_1px] shadow-primary/60" />
                {eyebrow}
              </span>
            </div>
          )}
          <h1
            className={`text-foreground text-balance tracking-tight text-4xl sm:text-5xl md:text-6xl xl:text-[80px] leading-[1.05] sm:leading-[1.05] md:leading-[1.05] lg:leading-[1.05] xl:leading-[1.04] mb-7 lg:text-7xl ${titleClassName}`}
            style={{ fontFamily, fontWeight }}
          >
            {title}{" "}
            <span className="bg-gradient-to-r from-primary to-[#a99dff] bg-clip-text text-transparent">
              {highlightText}
            </span>
          </h1>
          <p className={`text-base sm:text-lg text-white/70 text-pretty max-w-xl mx-auto leading-relaxed mb-11 px-4 ${descriptionClassName}`}>
            {description}
          </p>
          <button
            onClick={handleButtonClick}
            className={`px-7 py-3.5 sm:px-8 sm:py-4 rounded-full border border-white/15 bg-white/10 backdrop-blur-xl text-sm sm:text-[15px] font-medium text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_8px_32px_-4px_rgba(0,0,0,0.4)] hover:bg-white/15 hover:border-white/25 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_12px_40px_-4px_rgba(107,92,255,0.35)] transition-all duration-300 ${buttonClassName}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </section>
  )
}
