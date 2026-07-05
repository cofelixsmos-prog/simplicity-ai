"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, Mic, MicOff } from "lucide-react"

// ── Minimal Web Speech API typings (not in the standard DOM lib) ──────────────
interface SRAlternative {
  transcript: string
}
interface SRResult {
  0: SRAlternative
  isFinal: boolean
}
interface SREvent {
  results: ArrayLike<SRResult>
  resultIndex: number
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SREvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onstart: (() => void) | null
}
type SRCtor = new () => SpeechRecognitionLike

function getSRCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// Prefer an Indian-English voice for the reply, favouring locally-installed
// voices (remote voices often don't play on desktop Chrome). Falls back to any
// English voice, then whatever exists.
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0
    if (/en[-_]IN/i.test(v.lang)) s += 100
    if (/india|heera|ravi|rishi|aditi|priya|neel|hindi/i.test(v.name)) s += 60
    if (/^en/i.test(v.lang)) s += 20
    if (v.localService) s += 10 // local voices are reliable offline
    if (v.default) s += 1
    return s
  }
  return [...voices].sort((a, b) => score(b) - score(a))[0]
}

// getVoices() is async on desktop — resolve once the list is actually populated.
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([])
  const synth = window.speechSynthesis
  const now = synth.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve(synth.getVoices())
    }
    synth.addEventListener("voiceschanged", done, { once: true })
    setTimeout(done, 1200) // fallback if the event never fires
  })
}

type Status = "requesting" | "idle" | "listening" | "thinking" | "speaking" | "error"

export function VoiceMode({
  open,
  onClose,
  model,
}: {
  open: boolean
  onClose: () => void
  model: string
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [heard, setHeard] = useState("") // live transcript
  const [reply, setReply] = useState("") // what Simplicity is saying
  const [errorMsg, setErrorMsg] = useState("")
  const [muted, setMuted] = useState(false)

  // Audio-reactive level (0..1) driving the orb.
  const [level, setLevel] = useState(0)

  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const inAnalyserRef = useRef<AnalyserNode | null>(null) // mic input (listening)
  const outAnalyserRef = useRef<AnalyserNode | null>(null) // TTS output (speaking)
  const audioElRef = useRef<HTMLAudioElement | null>(null) // currently-playing backend audio
  const rafRef = useRef<number | null>(null)
  const convoRef = useRef<{ role: "user" | "assistant"; content: string }[]>([])
  const statusRef = useRef<Status>("idle")
  const mutedRef = useRef(false)
  const closingRef = useRef(false)
  // handleTurn ⇄ startListening call each other; go through refs to avoid a
  // declaration cycle and keep each callback's dependency list clean.
  const startListeningRef = useRef<() => void>(() => {})
  const handleTurnRef = useRef<(t: string) => void>(() => {})

  const setStat = (s: Status) => {
    statusRef.current = s
    setStatus(s)
  }

  // ── Speak a reply, then resume listening ───────────────────────────────────
  // Fallback: the browser's own speech engine (device-dependent voice). Only
  // used if the backend TTS is unavailable.
  const browserSpeak = useCallback((text: string, onDone: () => void) => {
    if (!("speechSynthesis" in window)) {
      onDone()
      return
    }
    const synth = window.speechSynthesis
    loadVoices().then((voices) => {
      synth.cancel()
      synth.resume()
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice(voices)
      if (v) {
        u.voice = v
        u.lang = v.lang
      }
      u.rate = 1.0
      u.pitch = 1.05
      let finished = false
      let keepAlive: ReturnType<typeof setInterval> | null = null
      const finish = () => {
        if (finished) return
        finished = true
        if (keepAlive) clearInterval(keepAlive)
        onDone()
      }
      u.onend = finish
      u.onerror = finish
      keepAlive = setInterval(() => {
        if (!synth.speaking) return
        synth.pause()
        synth.resume()
      }, 9000)
      setTimeout(() => {
        if (!finished && !synth.speaking) finish()
      }, Math.min(30000, 3000 + text.length * 90))
      synth.speak(u)
    })
  }, [])

  // ── Speak via the backend (consistent voice on every device) ───────────────
  // The audio is routed through an AnalyserNode so the orb reacts to the real
  // output. Falls back to the browser voice if the server has no TTS provider.
  const speak = useCallback(
    (text: string, onDone: () => void) => {
      if (!text.trim()) {
        onDone()
        return
      }
      let done = false
      const finish = () => {
        if (done) return
        done = true
        outAnalyserRef.current = null
        onDone()
      }
      ;(async () => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          })
          if (!res.ok) throw new Error("tts unavailable")
          const buf = await res.arrayBuffer()
          if (buf.byteLength < 128) throw new Error("empty audio")
          const url = URL.createObjectURL(new Blob([buf], { type: res.headers.get("Content-Type") || "audio/mpeg" }))
          // Play the element directly — the most reliable path to the speakers.
          // (No Web Audio routing here; that can silently swallow output if the
          // AudioContext is suspended. The orb uses a synthetic pulse instead.)
          const audio = new Audio(url)
          audio.volume = 1
          audioElRef.current = audio
          audio.onended = () => {
            URL.revokeObjectURL(url)
            finish()
          }
          audio.onerror = () => {
            URL.revokeObjectURL(url)
            browserSpeak(text, finish) // fall back to the browser voice
          }
          await audio.play()
        } catch {
          // No backend TTS (or network error) → browser voice.
          browserSpeak(text, finish)
        }
      })()
    },
    [browserSpeak]
  )

  // ── One conversational turn: transcript → model → speak ────────────────────
  const handleTurn = useCallback(
    async (text: string) => {
      const said = text.trim()
      if (!said) {
        if (!closingRef.current) startListeningRef.current()
        return
      }
      convoRef.current.push({ role: "user", content: said })
      setStat("thinking")
      setReply("")
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: convoRef.current.slice(-12),
            model,
            reasoning: "off",
            voice: true,
          }),
        })
        if (!res.ok || !res.body) throw new Error("no stream")
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let acc = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            const t = line.trim()
            if (!t) continue
            try {
              const ev = JSON.parse(t) as { t: string; v?: string }
              if (ev.t === "text" && ev.v) {
                acc += ev.v
                setReply(acc)
              }
            } catch {
              /* skip partial */
            }
          }
        }
        const finalText = acc.trim() || "uh… sorry bhai, kuch gadbad ho gaya. phir se bolo?"
        convoRef.current.push({ role: "assistant", content: finalText })
        if (closingRef.current) return
        setStat("speaking")
        speak(finalText, () => {
          if (!closingRef.current) startListeningRef.current()
        })
      } catch {
        if (closingRef.current) return
        setStat("speaking")
        speak("arre, connection thoda weak lag raha hai. ek baar phir try karo na.", () => {
          if (!closingRef.current) startListeningRef.current()
        })
      }
    },
    [model, speak]
  )

  // ── Start a listening window ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (closingRef.current || mutedRef.current) return
    const Ctor = getSRCtor()
    if (!Ctor) {
      setErrorMsg("Your browser doesn't support speech recognition. Try Chrome or Edge.")
      setStat("error")
      return
    }
    try {
      recRef.current?.abort()
    } catch {}
    const rec = new Ctor()
    rec.lang = "en-IN"
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    let finalText = ""
    rec.onstart = () => {
      setHeard("")
      setStat("listening")
    }
    rec.onresult = (e: SREvent) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      setHeard(finalText + interim)
    }
    rec.onerror = (e) => {
      // "no-speech"/"aborted" are normal — just cycle back to listening.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setErrorMsg("Microphone access was blocked. Allow the mic and reopen voice mode.")
        setStat("error")
      }
    }
    rec.onend = () => {
      if (closingRef.current || mutedRef.current) return
      if (finalText.trim()) handleTurnRef.current(finalText)
      else if (statusRef.current === "listening") startListeningRef.current() // heard nothing — keep going
    }
    recRef.current = rec
    try {
      rec.start()
    } catch {
      /* already started */
    }
  }, [])

  // Keep the cross-call refs pointing at the latest callbacks.
  useEffect(() => {
    startListeningRef.current = startListening
    handleTurnRef.current = handleTurn
  }, [startListening, handleTurn])

  // ── The orb animation loop — always runs while open ─────────────────────────
  // Reads the mic analyser while listening and the TTS-output analyser while
  // speaking (both best-effort); otherwise a gentle synthetic pulse.
  const startLoop = useCallback(() => {
    const buf = new Uint8Array(256)
    const rms = (a: AnalyserNode) => {
      a.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      return Math.sqrt(sum / buf.length)
    }
    let phase = 0
    const tick = () => {
      const st = statusRef.current
      if (st === "listening" && !mutedRef.current && inAnalyserRef.current) {
        setLevel((p) => p + (Math.min(1, rms(inAnalyserRef.current!) * 3.2) - p) * 0.35)
      } else if (st === "speaking" && outAnalyserRef.current) {
        setLevel((p) => p + (Math.min(1, rms(outAnalyserRef.current!) * 3.4) - p) * 0.4)
      } else if (st === "speaking") {
        phase += 0.28
        const target = 0.45 + Math.abs(Math.sin(phase)) * 0.4 * (0.7 + Math.random() * 0.3)
        setLevel((p) => p + (target - p) * 0.3)
      } else if (st === "thinking" || st === "requesting") {
        phase += 0.06
        setLevel((p) => p + (0.28 + Math.sin(phase) * 0.08 - p) * 0.1)
      } else {
        setLevel((p) => p + (0 - p) * 0.1)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  // ── Request mic permission + wire the input analyser ───────────────────────
  // Surfaces the mic prompt and feeds the orb while listening. Best-effort: if
  // getUserMedia is unavailable (embedded/insecure preview) speech recognition
  // still tries on its own. Returns granted / blocked / unavailable.
  const startMeter = useCallback(async (): Promise<"ok" | "denied" | "unavailable"> => {
    if (!navigator.mediaDevices?.getUserMedia) return "unavailable"
    setStat("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = audioCtxRef.current ?? new Ctx()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      inAnalyserRef.current = analyser
      return "ok"
    } catch (e) {
      return (e as { name?: string })?.name === "NotAllowedError" ? "denied" : "unavailable"
    }
  }, [])

  // ── Open / close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    closingRef.current = false
    mutedRef.current = false
    setMuted(false)
    convoRef.current = []
    setHeard("")
    setReply("")
    setErrorMsg("")
    // Warm up TTS: kick async voice loading and clear any leftover paused state.
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume()
      loadVoices()
    }
    startLoop() // orb animates regardless of mic availability
    ;(async () => {
      // Ask for the mic (drives the reactive orb + the permission prompt).
      const meter = await startMeter()
      if (closingRef.current) return
      if (meter === "denied") {
        setErrorMsg("Microphone access was blocked. Click the 🔒 icon in the address bar, allow the mic, then reopen voice mode.")
        setStat("error")
        return
      }
      // Speech recognition is the actual requirement (it has its own mic access,
      // so it works even when the orb meter is unavailable).
      if (!getSRCtor()) {
        setErrorMsg(
          "Voice needs speech recognition, which isn't available here. Open the app in Chrome or Edge, in a normal tab (not an embedded preview), over localhost or HTTPS."
        )
        setStat("error")
        return
      }
      startListening()
    })()

    return () => {
      closingRef.current = true
      try {
        recRef.current?.abort()
      } catch {}
      if ("speechSynthesis" in window) window.speechSynthesis.cancel()
      if (audioElRef.current) {
        audioElRef.current.pause()
        audioElRef.current = null
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close().catch(() => {})
      inAnalyserRef.current = null
      outAnalyserRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggleMute = () => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (next) {
      try {
        recRef.current?.abort()
      } catch {}
      if ("speechSynthesis" in window) window.speechSynthesis.cancel()
      audioElRef.current?.pause()
      outAnalyserRef.current = null
      setStat("idle")
    } else {
      startListening()
    }
  }

  if (!open) return null

  const statusText =
    status === "requesting"
      ? "Allow microphone access to start talking…"
      : status === "listening"
        ? heard || "Listening…"
        : status === "thinking"
          ? "Thinking…"
          : status === "speaking"
            ? reply || "Speaking…"
            : status === "error"
              ? errorMsg
              : muted
                ? "Muted"
                : "…"

  const scale = 1 + level * 0.55
  const glow = 0.25 + level * 0.6

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-black/70 px-6 backdrop-blur-2xl animate-in fade-in duration-700">
      {/* close */}
      <button
        onClick={onClose}
        aria-label="Close voice mode"
        className="absolute right-5 top-5 inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-5" />
      </button>

      {/* the orb */}
      <div className="relative flex h-64 w-64 items-center justify-center">
        {/* outer reactive halo */}
        <div
          className="absolute rounded-full bg-white/10 blur-2xl transition-transform duration-75"
          style={{ width: 240, height: 240, transform: `scale(${1 + level * 0.9})`, opacity: glow }}
        />
        {/* the core circle */}
        <div
          className="relative rounded-full transition-transform duration-75"
          style={{
            width: 150,
            height: 150,
            transform: `scale(${scale})`,
            background:
              status === "speaking"
                ? "radial-gradient(circle at 35% 30%, #fde9c8, #e8a24d 55%, #b5701f)"
                : status === "thinking"
                  ? "radial-gradient(circle at 35% 30%, #cfd6e6, #7f8aa6 55%, #4a5570)"
                  : "radial-gradient(circle at 35% 30%, #ffffff, #cbd5e1 55%, #7c8aa0)",
            boxShadow: `0 0 ${40 + level * 90}px ${8 + level * 30}px rgba(255,255,255,${0.15 + level * 0.35})`,
          }}
        />
        {/* subtle inner ring */}
        <div className="absolute rounded-full border border-white/20" style={{ width: 150, height: 150, transform: `scale(${scale})` }} />
      </div>

      {/* status / transcript */}
      <p className="mt-10 max-w-lg text-center text-lg font-medium leading-relaxed text-white/85">
        {statusText}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.25em] text-white/35">
        {status === "error" ? "Voice unavailable" : "Voice mode"}
      </p>

      {/* mic mute toggle */}
      {status !== "error" && (
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className={`mt-10 inline-flex size-14 items-center justify-center rounded-full border transition-colors ${
            muted
              ? "border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25"
              : "border-white/15 text-white/80 hover:bg-white/10"
          }`}
        >
          {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
        </button>
      )}
    </div>
  )
}
