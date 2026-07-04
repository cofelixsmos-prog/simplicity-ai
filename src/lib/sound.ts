// Tactile sound design — synthesized, not sampled. Every sound is generated
// in WebAudio at call time: zero files, zero latency, zero network. Tuned to
// the Apple school: barely-there, felt more than heard. Volumes sit around
// -28dB so it registers as texture, never as noise.
//
// The AudioContext is created lazily on the first user gesture (browsers
// require one anyway) and shared for life.

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** One enveloped oscillator: freq can glide, gain decays exponentially. */
function tone(
  a: AudioContext,
  {
    type = "sine",
    from,
    to,
    dur,
    gain,
    at = 0,
  }: { type?: OscillatorType; from: number; to?: number; dur: number; gain: number; at?: number }
) {
  const t0 = a.currentTime + at
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** A whisper of filtered noise — the "contact" texture under a click. */
function tick(a: AudioContext, gain = 0.015) {
  const dur = 0.03
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = a.createBufferSource()
  src.buffer = buf
  const hp = a.createBiquadFilter()
  hp.type = "highpass"
  hp.frequency.value = 2400
  const g = a.createGain()
  g.gain.value = gain
  src.connect(hp).connect(g).connect(a.destination)
  src.start()
}

/** Soft button click — a muted keyboard "tock". */
export function playClick() {
  const a = ac()
  if (!a) return
  tone(a, { type: "sine", from: 1900, to: 1300, dur: 0.045, gain: 0.03 })
  tick(a, 0.012)
}

/** Message sent — a gentle upward swoop, like the bubble lifting off. */
export function playSend() {
  const a = ac()
  if (!a) return
  tone(a, { type: "sine", from: 440, to: 880, dur: 0.14, gain: 0.035 })
  tone(a, { type: "sine", from: 880, to: 1320, dur: 0.1, gain: 0.018, at: 0.05 })
}

/** Turn finished — one low, warm settle. Quietest of all. */
export function playDone() {
  const a = ac()
  if (!a) return
  tone(a, { type: "sine", from: 620, to: 520, dur: 0.16, gain: 0.02 })
}

// Typing ticks fire once per keystroke, so a held/repeating key (or a fast
// typist) can queue calls faster than the ear can separate — throttle both
// to a floor gap so a burst reads as quick taps, not a buzz.
let lastTypeAt = 0
let lastBackspaceAt = 0
const TYPE_MIN_GAP = 32

/** Soft typing tick — quicker and quieter than the button click, with a
 * touch of random pitch drift so a fast burst doesn't sound mechanical. */
export function playType() {
  const a = ac()
  if (!a) return
  const now = a.currentTime
  if (now - lastTypeAt < TYPE_MIN_GAP / 1000) return
  lastTypeAt = now
  const base = 1450 + Math.random() * 550
  tone(a, { type: "sine", from: base, to: base - 260, dur: 0.026, gain: 0.014 })
}

/** Backspace — a shade lower and duller than a regular key, so deleting
 * reads distinctly from typing without needing to look at the screen. */
export function playBackspace() {
  const a = ac()
  if (!a) return
  const now = a.currentTime
  if (now - lastBackspaceAt < TYPE_MIN_GAP / 1000) return
  lastBackspaceAt = now
  tone(a, { type: "sine", from: 720, to: 540, dur: 0.032, gain: 0.017 })
}
