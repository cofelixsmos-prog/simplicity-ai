// Ambient color-temperature curve — Apple Night Shift / True Tone flavored,
// but gray is the resting default. Blue and orange only show up during the
// actual morning and night windows; the long midday-through-evening stretch
// stays neutral gray, same as it always has.
//
// Returns a signed value in [-1, 1]:
//   -1  → coolest (blue, ~6500K) — held through core morning hours
//    0  → neutral gray — the default for most of the day/evening
//   +1  → warmest (amber, ~3500K) — held through the core of the night
//
// Modeled as a handful of (hour, value) keyframes with smoothstep easing
// between them, so it drifts in and out rather than snapping — but holds
// flat at 0 for the long gray stretch instead of drifting all day.
const POINTS: [hour: number, value: number][] = [
  [0, 1], // midnight — still warm from the night before
  [3, 1], // hold warm through the middle of the night
  [6, -1], // quick pre-dawn swing straight to cool
  [9, -1], // hold cool through core morning
  [11, 0], // back to neutral by mid-morning
  [19, 0], // gray default: late morning through early evening
  [21, 1], // warm ramps in for the evening
  [24, 1], // hold warm into midnight (wraps to hour 0)
]

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

export function ambientTemperature(date: Date = new Date()): number {
  const hour = date.getHours() + date.getMinutes() / 60
  for (let i = 0; i < POINTS.length - 1; i++) {
    const [h0, v0] = POINTS[i]
    const [h1, v1] = POINTS[i + 1]
    if (hour >= h0 && hour <= h1) {
      const t = h1 === h0 ? 0 : smoothstep((hour - h0) / (h1 - h0))
      return v0 + (v1 - v0) * t
    }
  }
  return 0
}
