"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, X, Pin, PinOff, Pencil, Trash2, MessageSquare, Check } from "lucide-react"
import type { ConvoLite } from "./chat-sidebar"

// A manager for all conversations: search, pin to top, rename inline, delete,
// and open. Opened from ⌘K — keeps the main UI minimal while giving real
// chat-management depth on demand.
export function ChatsPanel({
  open,
  conversations,
  activeId,
  onClose,
  onSelect,
  onRename,
  onPin,
  onDelete,
}: {
  open: boolean
  conversations: ConvoLite[]
  activeId: string | null
  onClose: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onPin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
}) {
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ("")
      setEditing(null)
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (editing ? setEditing(null) : onClose())
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, editing, onClose])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle ? conversations.filter((c) => c.title.toLowerCase().includes(needle)) : conversations
    // Pinned first, then most-recent (the parent already sorts, but keep it stable here too).
    return [...list].sort((a, b) => (b.pinned ?? 0) - (a.pinned ?? 0) || b.updatedAt - a.updatedAt)
  }, [conversations, q])

  if (!open) return null

  const commitRename = (id: string) => {
    const t = draft.trim()
    if (t) onRename(id, t.slice(0, 200))
    setEditing(null)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[8vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="liquid-glass liquid-glass-soft relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* search header */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <Search className="size-4 shrink-0 text-white/45" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats…"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
          <button onClick={onClose} className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-white/45">
              {conversations.length === 0 ? "No conversations yet." : "No chats match that search."}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors ${
                    c.id === activeId ? "bg-white/10" : "hover:bg-white/[0.05]"
                  }`}
                >
                  {c.pinned ? (
                    <Pin className="size-3.5 shrink-0 text-white/55" />
                  ) : (
                    <MessageSquare className="size-3.5 shrink-0 text-white/35" />
                  )}

                  {editing === c.id ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitRename(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(c.id)
                      }}
                      className="min-w-0 flex-1 rounded-md bg-white/10 px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                    />
                  ) : (
                    <button onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate text-left text-sm text-white/85">
                      {c.title}
                    </button>
                  )}

                  {/* row actions */}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {editing === c.id ? (
                      <button onClick={() => commitRename(c.id)} className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white" aria-label="Save name">
                        <Check className="size-3.5" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onPin(c.id, !c.pinned)}
                          className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                          aria-label={c.pinned ? "Unpin" : "Pin"}
                        >
                          {c.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            setEditing(c.id)
                            setDraft(c.title)
                          }}
                          className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                          aria-label="Rename"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(c.id)}
                          className="rounded-md p-1.5 text-white/50 hover:bg-red-500/15 hover:text-red-300"
                          aria-label="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
