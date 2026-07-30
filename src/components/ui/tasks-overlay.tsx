"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Loader2, Pause, Play, Trash2, X, Mail, FolderOpen, ArrowUpRight } from "lucide-react"

interface Task {
  id: string
  name: string
  status: "draft" | "running" | "paused"
  services: string[]
  stats: Record<string, number>
  lastActionAt: number | null
}

function rel(ts: number | null): string {
  if (!ts) return "no actions yet"
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "active just now"
  if (s < 3600) return `last action ${Math.floor(s / 60)}m ago`
  if (s < 86400) return `last action ${Math.floor(s / 3600)}h ago`
  return `last action ${Math.floor(s / 86400)}d ago`
}

// A quick "what's running right now" panel, opened from the ⌘K palette in chat.
// Lists background automations and lets you pause or remove each individually.
export function TasksOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/automations")
      if (r.ok) {
        const d = await r.json()
        setTasks((d.automations ?? []).filter((a: Task) => a.status !== "draft"))
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    load()
    const iv = setInterval(load, 8000)
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => { clearInterval(iv); window.removeEventListener("keydown", onKey) }
  }, [open, load, onClose])

  if (!open) return null

  const act = async (id: string, method: "PATCH" | "DELETE", body?: Record<string, unknown>) => {
    setBusy(id)
    try {
      await fetch(`/api/automations/${id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      await load()
    } finally { setBusy(null) }
  }

  const running = tasks.filter((t) => t.status === "running").length

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-hidden px-4 py-[10vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="liquid-glass liquid-glass-soft relative z-10 flex max-h-[75vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-white">
            <Bot className="size-4 text-white/60" />
            Running tasks
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">{running} active</span>
          </span>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-2" data-lenis-prevent>
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-8 text-sm text-white/40"><Loader2 className="size-4 animate-spin" />Loading…</div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><Bot className="size-6 text-white/25" strokeWidth={1.3} /></div>
              <p className="text-sm text-white/50">No automations running.</p>
              <p className="text-[12px] text-white/35">Just ask in chat — e.g. “check my mail 24/7 and reply professionally.”</p>
            </div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="mb-1.5 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                  {t.services.includes("drive") && !t.services.includes("gmail") ? <FolderOpen className="size-4 text-white/60" /> : <Mail className="size-4 text-white/60" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{t.name}</span>
                    <span className={`size-1.5 rounded-full shadow-[0_0_7px] ${t.status === "running" ? "bg-emerald-400 shadow-emerald-400/60" : "bg-amber-400 shadow-amber-400/60"}`} />
                  </div>
                  <p className="truncate text-[11.5px] text-white/40">
                    {(t.stats.repliesSent ?? 0) > 0 ? `${t.stats.repliesSent} replies · ` : ""}{rel(t.lastActionAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {t.status === "running" ? (
                    <button title="Pause" disabled={busy === t.id} onClick={() => act(t.id, "PATCH", { status: "paused" })} className="flex size-7 items-center justify-center rounded-full border border-white/10 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40">
                      {busy === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
                    </button>
                  ) : (
                    <button title="Resume" disabled={busy === t.id} onClick={() => act(t.id, "PATCH", { status: "running" })} className="flex size-7 items-center justify-center rounded-full border border-white/10 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40">
                      {busy === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    </button>
                  )}
                  <button title="Remove" disabled={busy === t.id} onClick={() => act(t.id, "DELETE")} className="flex size-7 items-center justify-center rounded-full border border-white/10 text-white/50 hover:border-red-400/40 hover:text-red-300 disabled:opacity-40">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {tasks.length > 0 && (
          <a href="/settings#automations" className="flex items-center justify-center gap-1.5 border-t border-white/10 py-2.5 text-[13px] text-white/60 hover:bg-white/[0.03] hover:text-white">
            History &amp; details in Settings<ArrowUpRight className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
