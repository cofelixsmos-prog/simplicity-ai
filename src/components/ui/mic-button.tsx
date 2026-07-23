"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic } from "lucide-react"
import { Tooltip } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/toast"

const ERROR_MESSAGE: Record<string, string> = {
  "not-allowed": "Microphone access is blocked — allow it in your browser's site settings.",
  "no-speech": "Didn't catch that — no speech detected.",
  "audio-capture": "No microphone found.",
  network: "Speech recognition needs a network connection.",
  aborted: "", // user-initiated stop — not an error worth surfacing
}

// getUserMedia's own error names, for the explicit permission request below.
const GUM_ERROR_MESSAGE: Record<string, string> = {
  NotAllowedError: "Microphone access denied — allow it when your browser asks, or check its site settings.",
  NotFoundError: "No microphone found on this device.",
  NotReadableError: "Another app has the microphone locked — close it and try again.",
  SecurityError: "Microphone access needs a secure (https) connection.",
}

// ── Minimal Web Speech API typings (not in the standard DOM lib) ────────────
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
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// Mic system, step two: real speech-to-text. Click to start listening — the
// live transcript streams into the composer as you talk (interim results
// update in place, so you see words land before you finish the sentence).
// Click again, or stop talking, and it commits back to a normal text input.
export function MicButton({
  baseText,
  onResult,
  onListeningChange,
}: {
  baseText: string
  onResult: (text: string) => void
  onListeningChange?: (listening: boolean) => void
}) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseRef = useRef(baseText)
  const finalRef = useRef("")

  useEffect(() => {
    setSupported(!!getSRCtor())
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(async () => {
    const Ctor = getSRCtor()
    if (!Ctor) return

    // SpeechRecognition is supposed to raise the mic permission prompt itself,
    // but on some Chrome builds/policies it just fails silently with no prompt
    // at all. Requesting getUserMedia directly is the one call guaranteed to
    // surface the native "Allow microphone?" dialog (or a real, specific
    // error) — we don't need the stream itself, only its side effect.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch (err) {
      const name = err instanceof Error ? err.name : ""
      toast(GUM_ERROR_MESSAGE[name] ?? "Couldn't access the microphone.", "error")
      return
    }

    const recognition = new Ctor()
    recognition.lang = "en-IN"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    finalRef.current = ""
    baseRef.current = baseText

    recognition.onstart = () => {
      setListening(true)
      onListeningChange?.(true)
    }
    recognition.onend = () => {
      setListening(false)
      onListeningChange?.(false)
    }
    recognition.onerror = (e) => {
      setListening(false)
      onListeningChange?.(false)
      const msg = e.error ? ERROR_MESSAGE[e.error] ?? `Mic error: ${e.error}` : ""
      if (msg) toast(msg, "error")
    }
    recognition.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) finalRef.current += chunk
        else interim += chunk
      }
      const spacer = baseRef.current && !/\s$/.test(baseRef.current) ? " " : ""
      onResult(`${baseRef.current}${spacer}${finalRef.current}${interim}`)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      setListening(false)
      onListeningChange?.(false)
      toast(err instanceof Error ? err.message : "Couldn't start the mic.", "error")
    }
  }, [baseText, onResult, onListeningChange])

  // Stop cleanly if the composer unmounts mid-dictation.
  useEffect(() => () => recognitionRef.current?.stop(), [])

  const handleClick = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  if (!supported) {
    return (
      <Tooltip label="Speech recognition isn't supported in this browser (try Chrome or Edge)" side="top">
        <span className="inline-flex size-8 items-center justify-center rounded-full text-white/20">
          <Mic className="size-4" />
        </span>
      </Tooltip>
    )
  }

  return (
    <Tooltip label={listening ? "Listening… click to stop" : "Speak"} side="top">
      <button
        type="button"
        onClick={handleClick}
        aria-label={listening ? "Stop listening" : "Speak"}
        aria-pressed={listening}
        className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${
          listening ? "bg-red-500/20 text-red-300" : "text-white/55 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Mic className={`size-4 ${listening ? "animate-pulse" : ""}`} />
      </button>
    </Tooltip>
  )
}
