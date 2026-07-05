"use client"

import { useState } from "react"
import { Inbox, Star, Trash2, Loader2, Check, AlertTriangle } from "lucide-react"

export interface InboxItem {
  uid: number
  from: string
  subject: string
  date: string
  seen: boolean
  flagged: boolean
  snippet: string
}

export interface DeleteItem {
  uid: number
  subject: string
  from: string
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(+d)) return ""
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" })
}

// Read-only inbox listing produced by read_emails.
export function InboxCard({ items }: { items: InboxItem[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-white/10">
          <Inbox className="size-4 text-white/80" />
        </span>
        <span className="text-sm font-medium text-white">
          {items.length} email{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="max-h-[400px] divide-y divide-white/5 overflow-y-auto">
        {items.map((e) => (
          <li key={e.uid} className="flex gap-3 px-4 py-3">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.seen ? "bg-transparent" : "bg-sky-400"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`truncate text-sm ${e.seen ? "text-white/70" : "font-semibold text-white"}`}>
                  {e.from || "(unknown sender)"}
                </span>
                {e.flagged && <Star className="size-3 shrink-0 fill-amber-300 text-amber-300" />}
                <span className="ml-auto shrink-0 text-[11px] text-white/40">{shortDate(e.date)}</span>
              </div>
              <div className={`truncate text-[13px] ${e.seen ? "text-white/55" : "text-white/80"}`}>{e.subject}</div>
              {e.snippet && <div className="mt-0.5 truncate text-xs text-white/40">{e.snippet}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Confirmation card for moving emails to Trash (recoverable).
export function DeleteEmailCard({ items }: { items: DeleteItem[] }) {
  const [phase, setPhase] = useState<"review" | "sending" | "done">("review")
  const [error, setError] = useState<string | null>(null)
  const [trashed, setTrashed] = useState(0)

  async function doDelete() {
    setPhase("sending")
    setError(null)
    try {
      const res = await fetch("/api/email/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: items.map((i) => i.uid) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? "Delete failed.")
        setPhase("review")
        return
      }
      setTrashed(data.trashed ?? items.length)
      setPhase("done")
    } catch {
      setError("Network error — please try again.")
      setPhase("review")
    }
  }

  if (phase === "done") {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="size-4 text-emerald-300" />
        </span>
        <span className="text-sm text-white/80">
          Moved {trashed} email{trashed === 1 ? "" : "s"} to Trash (recoverable in Gmail for 30 days).
        </span>
      </div>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-red-500/15">
          <Trash2 className="size-4 text-red-300" />
        </span>
        <span className="text-sm font-medium text-white">
          Move {items.length} email{items.length === 1 ? "" : "s"} to Trash?
        </span>
      </div>
      <ul className="max-h-[280px] divide-y divide-white/5 overflow-y-auto">
        {items.map((e) => (
          <li key={e.uid} className="px-4 py-2.5">
            <div className="truncate text-sm text-white/85">{e.subject || "(no subject)"}</div>
            {e.from && <div className="truncate text-xs text-white/45">{e.from}</div>}
          </li>
        ))}
      </ul>
      {error && <p className="border-t border-red-400/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">{error}</p>}
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
        <button
          onClick={doDelete}
          disabled={phase === "sending"}
          className="inline-flex items-center gap-2 rounded-full bg-red-500/90 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500 active:scale-[0.99] disabled:opacity-50"
        >
          {phase === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Move to Trash
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
          <AlertTriangle className="size-3.5" />
          Recoverable in Gmail
        </span>
      </div>
    </div>
  )
}
