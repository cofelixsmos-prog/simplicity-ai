"use client"

import { ShaderBackground } from "@/components/ui/shader-background"
import { Navbar } from "@/components/ui/navbar"

// "Vordex" cut out of black, filled with the animated shader — rendered DENSE
// (scaled down) so its motion is clearly visible inside the letters. No border.
const TEXT_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 300'%3E%3Ctext x='500' y='226' font-family='Arial,Helvetica,sans-serif' font-size='250' font-weight='700' letter-spacing='-10' text-anchor='middle' fill='white'%3EVordex%3C/text%3E%3C/svg%3E\")"

// How many times denser than 1:1 — bigger = smaller shader features in the text.
const DENSITY = 6

export default function VordexPage() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-black px-6">
      <span className="sr-only">Vordex — Model Fusion</span>

      {/* the site's floating pill navigation bar */}
      <Navbar />

      <div
        className="vx-word relative overflow-hidden"
        style={{
          width: "min(90vw, 1200px)",
          height: "calc(min(90vw, 1200px) * 0.3)",
          WebkitMaskImage: TEXT_MASK,
          maskImage: TEXT_MASK,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: `${DENSITY * 100}%`,
            height: `${DENSITY * 100}%`,
            transform: `translate(-50%, -50%) scale(${1 / DENSITY})`,
            filter: "brightness(1.5) saturate(1.25) contrast(1.1)",
          }}
        >
          <ShaderBackground />
        </div>
      </div>

      <style>{`
        .vx-word{opacity:0;animation:vxin 2s cubic-bezier(.16,1,.3,1) .1s forwards}
        @keyframes vxin{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:none}}
        @media(prefers-reduced-motion:reduce){.vx-word{opacity:1;animation:none;transform:none}}
      `}</style>
    </div>
  )
}
