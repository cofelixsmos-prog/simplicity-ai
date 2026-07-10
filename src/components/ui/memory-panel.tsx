"use client"

import { useEffect, useState } from "react"
import { Brain, Trash2, X, Loader2 } from "lucide-react"

interface Memory {
  id: string
  content: string
  createdAt: number
}

// A viewer for the assistant's long-term memory: what it knows about you, with
// controls to forget individual items or clear everything. Opened from ⌘K.
export function MemoryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Memory[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setItems(null)
    fetch("/api/memories")
      .then((r) => (r.ok ? r.json() : { memories: [] }))
      .then((d) => setItems(d.memories ?? []))
      .catch(() => setItems([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const forget = async (id: string) => {
    setItems((xs) => xs?.filter((m) => m.id !== id) ?? null)
    await fetch(`/api/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {})
  }
  const clearAll = async () => {
    setBusy(true)
    setItems([])
    await fetch("/api/memories?all=1", { method: "DELETE" }).catch(() => {})
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="liquid-glass liquid-glass-soft relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <Brain className="size-4 text-white/70" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">Memory</div>
            <div className="text-[11px] text-white/45">What Simplicity remembers about you across chats</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {items === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/45">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-white/45">
              Nothing remembered yet. As you chat, Simplicity will note lasting preferences, goals, and projects here.
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((m) => (
                <li key={m.id} className="group flex items-start gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.05]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/30" />
                  <span className="flex-1 text-sm leading-relaxed text-white/85">{m.content}</span>
                  <button
                    onClick={() => forget(m.id)}
                    className="rounded-full p-1 text-white/0 transition-colors group-hover:text-white/40 hover:bg-white/10 hover:!text-white"
                    aria-label="Forget this"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* footer */}
        {items && items.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <span className="text-[11px] text-white/40">{items.length} {items.length === 1 ? "memory" : "memories"}</span>
            <button
              onClick={clearAll}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" /> Forget everything
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
