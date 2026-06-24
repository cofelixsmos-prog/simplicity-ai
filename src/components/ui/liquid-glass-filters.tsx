// Hidden SVG filters that power the .liquid-glass / .liquid-glass-soft
// utilities in globals.css. Render once near the root of a page.
export function LiquidGlassFilters() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        <filter
          id="liquid-glass-filter"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.008"
            numOctaves={2}
            seed={92}
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="blur" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blur"
            scale="60"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter
          id="liquid-glass-filter-soft"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.006"
            numOctaves={2}
            seed={42}
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="3" result="blur" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blur"
            scale="34"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
