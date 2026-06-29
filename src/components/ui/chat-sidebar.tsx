"use client"

import { Plus, MessageSquare, Trash2, LogOut } from "lucide-react"

export interface ConvoLite {
  id: string
  title: string
  updatedAt: number
}

export function ChatSidebar({
  conversations,
  activeId,
  userEmail,
  onSelect,
  onNew,
  onDelete,
  onLogout,
}: {
  conversations: ConvoLite[]
  activeId: string | null
  userEmail?: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onLogout: () => void
}) {
  return (
    <aside className="relative z-20 hidden h-full w-64 shrink-0 flex-col border-r border-white/10 bg-black/30 backdrop-blur-xl md:flex">
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <Plus className="size-4" /> New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-4 text-xs text-white/35">No conversations yet</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                c.id === activeId ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5"
              }`}
            >
              <button onClick={() => onSelect(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <MessageSquare className="size-3.5 shrink-0 text-white/40" />
                <span className="truncate">{c.title}</span>
              </button>
              <button
                onClick={() => onDelete(c.id)}
                aria-label="Delete conversation"
                className="shrink-0 rounded p-1 text-white/30 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-white/55">{userEmail}</span>
          <button
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
