"use client"

import { useEffect, useState } from "react"

/**
 * Apple-Intelligence-style activation flash.
 * When `trigger` changes, a soft light blooms in from the screen edges,
 * holds briefly, then fades away completely. Not a persistent border.
 */
export function ReasoningAura({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (trigger === 0) return // skip initial mount
    setActive(true)
    const t = setTimeout(() => setActive(false), 2600) // matches animation length
    return () => clearTimeout(t)
  }, [trigger])

  if (!active) return null

  return (
    <div
      key={trigger}
      className="reasoning-aura pointer-events-none fixed inset-0 z-40"
      aria-hidden
    >
      {/* Edge bloom — soft white light pulled in from all four sides */}
      <div className="aura-glow absolute inset-0" />

      <style jsx>{`
        .aura-glow {
          background:
            radial-gradient(120% 60% at 50% -10%, rgba(255, 255, 255, 0.55), transparent 60%),
            radial-gradient(120% 60% at 50% 110%, rgba(255, 255, 255, 0.55), transparent 60%),
            radial-gradient(60% 120% at -10% 50%, rgba(255, 255, 255, 0.45), transparent 60%),
            radial-gradient(60% 120% at 110% 50%, rgba(255, 255, 255, 0.45), transparent 60%);
          filter: blur(8px);
          opacity: 0;
          /* subtle cool tint via a second layer */
          animation: aura-bloom 2600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        /* faint inner ring that sweeps in then releases */
        .reasoning-aura::after {
          content: "";
          position: absolute;
          inset: 0;
          box-shadow:
            inset 0 0 0 1.5px rgba(255, 255, 255, 0.5),
            inset 0 0 60px 8px rgba(186, 230, 253, 0.35);
          opacity: 0;
          animation: aura-ring 2600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes aura-bloom {
          0% {
            opacity: 0;
            transform: scale(1.04);
          }
          22% {
            opacity: 1;
            transform: scale(1);
          }
          55% {
            opacity: 0.85;
          }
          100% {
            opacity: 0;
            transform: scale(1);
          }
        }
        @keyframes aura-ring {
          0% {
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          60% {
            opacity: 0.6;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
