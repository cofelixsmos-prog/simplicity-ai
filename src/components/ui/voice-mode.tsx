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

// Prefer an Indian-English voice for the reply (Heera/Ravi/Rishi on various OSes).
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const byLang = voices.filter((v) => /en[-_]IN/i.test(v.lang))
  const named = voices.find((v) => /india|heera|ravi|rishi|aditi|priya|neel/i.test(v.name))
  return byLang[0] ?? named ?? voices.find((v) => /^en/i.test(v.lang))
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
  const analyserRef = useRef<AnalyserNode | null>(null)
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
  const speak = useCallback((text: string, onDone: () => void) => {
    if (!("speechSynthesis" in window) || !text.trim()) {
      onDone()
      return
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice(synth.getVoices())
    if (v) u.voice = v
    u.lang = v?.lang || "en-IN"
    u.rate = 1.02
    u.pitch = 1.05
    u.onend = onDone
    u.onerror = onDone
    synth.speak(u)
  }, [])

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

  // ── Request mic permission + wire the amplitude meter ──────────────────────
  // The meter is ONLY for the reactive orb. It surfaces the mic prompt, but it's
  // best-effort: if getUserMedia is unavailable (e.g. an embedded/insecure
  // preview) we still let speech recognition try on its own. Returns whether it
  // was granted, blocked, or simply unavailable.
  const startMeter = useCallback(async (): Promise<"ok" | "denied" | "unavailable"> => {
    if (!navigator.mediaDevices?.getUserMedia) return "unavailable"
    setStat("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      let speakPhase = 0
      const tick = () => {
        const st = statusRef.current
        if (st === "listening" && !mutedRef.current) {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length) // 0..~0.5
          setLevel((prev) => prev + (Math.min(1, rms * 3.2) - prev) * 0.35)
        } else if (st === "speaking") {
          // No easy way to read TTS output — synthesize a lively pulse.
          speakPhase += 0.28
          const target = 0.45 + Math.abs(Math.sin(speakPhase)) * 0.4 * (0.7 + Math.random() * 0.3)
          setLevel((prev) => prev + (target - prev) * 0.3)
        } else if (st === "thinking") {
          speakPhase += 0.06
          setLevel((prev) => prev + (0.28 + Math.sin(speakPhase) * 0.08 - prev) * 0.1)
        } else {
          setLevel((prev) => prev + (0 - prev) * 0.1)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
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
    // Warm up TTS voices (getVoices can be empty until this fires).
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices()
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close().catch(() => {})
      analyserRef.current = null
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
