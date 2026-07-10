"use client"

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react"
import { Search, CornerDownLeft } from "lucide-react"

export interface Command {
  id: string
  label: string
  group?: string
  hint?: string // shortcut, or current value (e.g. "active")
  keywords?: string
  icon?: ComponentType<{ className?: string }>
  run: () => void
}

// Global ⌘K / Ctrl+K command palette. Opens via the hotkey or a
// window "open-cmdk" event (so a button anywhere can trigger it).
export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [modKey, setModKey] = useState("⌘")
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    setModKey(isMac ? "⌘" : "Ctrl")
  }, [])

  // Hotkey + external open event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("open-cmdk", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("open-cmdk", onOpen)
    }
  }, [])

  // Reset query/selection and focus the input each time it opens.
  useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.group ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q))
  }, [query, commands])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  const run = (c?: Command) => {
    if (!c) return
    setOpen(false)
    c.run()
  }

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      run(filtered[active])
    }
  }

  if (!open) return null

  // Group while preserving the flat index used for keyboard nav.
  let flatIdx = -1
  const groups: { name: string; items: { cmd: Command; idx: number }[] }[] = []
  for (const cmd of filtered) {
    flatIdx++
    const name = cmd.group ?? ""
    const g = groups.find((x) => x.name === name)
    const entry = { cmd, idx: flatIdx }
    if (g) g.items.push(entry)
    else groups.push({ name, items: [entry] })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden px-4 py-8 animate-in fade-in duration-150">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="liquid-glass liquid-glass-soft relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 ease-out"
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4">
          <Search className="size-4 shrink-0 text-white/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Type a command or search…"
            className="w-full bg-transparent py-3.5 text-[15px] text-white placeholder:text-white/40 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/40 sm:block">
            {modKey} K
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-white/40">No matching commands</p>
          ) : (
            groups.map((g) => (
              <div key={g.name || "_"} className="mb-1">
                {g.name && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    {g.name}
                  </p>
                )}
                {g.items.map(({ cmd, idx }) => {
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      data-idx={idx}
                      type="button"
                      onMouseMove={() => setActive(idx)}
                      onClick={() => run(cmd)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        idx === active ? "bg-white/10 text-white" : "text-white/70"
                      }`}
                    >
                      {Icon && <Icon className="size-4 shrink-0 text-white/50" />}
                      <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                      {cmd.hint && <span className="shrink-0 text-[11px] text-white/35">{cmd.hint}</span>}
                      {idx === active && <CornerDownLeft className="size-3.5 shrink-0 text-white/40" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
