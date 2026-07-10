"use client"

import { useEffect, useState } from "react"
import { BookOpen, Loader2, X } from "lucide-react"

// Active in focus mode: double-click any word in the chat to see its meaning in
// a small popover. Definitions come from the free dictionaryapi.dev (CORS-open,
// no key). Mounting/unmounting this component turns the behavior on/off.
interface Meaning {
  partOfSpeech: string
  definition: string
}
interface Popover {
  x: number
  y: number
  word: string
  loading: boolean
  phonetic?: string
  meanings?: Meaning[]
  error?: string
}

export function DictionaryLookup() {
  const [pop, setPop] = useState<Popover | null>(null)

  useEffect(() => {
    const onDbl = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      // Don't hijack double-clicks in editable / interactive controls.
      if (target?.closest("input, textarea, button, a, [contenteditable='true']")) return

      const sel = (window.getSelection?.()?.toString() ?? "").trim()
      const word = sel.replace(/[^A-Za-z'-]/g, "")
      if (!word || word.length < 2 || /\s/.test(sel)) return

      const x = Math.min(e.clientX, window.innerWidth - 300)
      const y = Math.min(e.clientY + 14, window.innerHeight - 220)
      setPop({ x, y, word, loading: true })
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`)
        if (!res.ok) throw new Error("not found")
        const data = (await res.json()) as {
          word: string
          phonetic?: string
          meanings?: { partOfSpeech?: string; definitions?: { definition?: string }[] }[]
        }[]
        const entry = data[0]
        const meanings: Meaning[] = (entry.meanings ?? [])
          .slice(0, 3)
          .map((m) => ({ partOfSpeech: m.partOfSpeech ?? "", definition: m.definitions?.[0]?.definition ?? "" }))
          .filter((m) => m.definition)
        setPop((p) => (p && p.word === word ? { ...p, loading: false, phonetic: entry.phonetic, meanings } : p))
      } catch {
        setPop((p) => (p && p.word === word ? { ...p, loading: false, error: `No definition found for “${word}”.` } : p))
      }
    }
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest("[data-dict-popover]")) setPop(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPop(null)
    }
    document.addEventListener("dblclick", onDbl)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("dblclick", onDbl)
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  if (!pop) return null

  return (
    <div
      data-dict-popover
      style={{ left: pop.x, top: pop.y }}
      className="liquid-glass liquid-glass-soft fixed z-[220] w-[280px] rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <BookOpen className="size-3.5 shrink-0 text-white/50" />
        <span className="text-[15px] font-semibold capitalize text-white">{pop.word}</span>
        {pop.phonetic && <span className="font-mono text-xs text-white/40">{pop.phonetic}</span>}
        <button
          onClick={() => setPop(null)}
          className="ml-auto rounded-full p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {pop.loading ? (
        <div className="flex items-center gap-2 py-1 text-sm text-white/50">
          <Loader2 className="size-3.5 animate-spin" />
          Looking up…
        </div>
      ) : pop.error ? (
        <p className="text-sm text-white/50">{pop.error}</p>
      ) : (
        <ul className="space-y-2">
          {pop.meanings?.map((m, i) => (
            <li key={i} className="text-sm leading-relaxed">
              {m.partOfSpeech && (
                <span className="mr-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                  {m.partOfSpeech}
                </span>
              )}
              <span className="text-white/80">{m.definition}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
