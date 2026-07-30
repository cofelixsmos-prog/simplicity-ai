"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Pause, Play, Trash2, Mail, FolderOpen, ChevronDown, Check, X, Clock, Activity, ArrowUp, Sparkles } from "lucide-react"

interface Automation {
  id: string
  name: string
  prompt: string
  status: "draft" | "running" | "paused"
  services: string[]
  stats: Record<string, number>
  createdAt: number
  lastActionAt: number | null
}
interface Evt { id: string; ts: number; kind: string; title: string; status: string }

function rel(ts: number | null): string {
  if (!ts) return "—"
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// The automations history + control surface, embedded in Settings. Creation now
// happens in chat; this is where the user reviews what's running and what each
// one has done.
export function AutomationsSettings() {
  const [items, setItems] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/automations")
      if (r.ok) { const d = await r.json(); setItems(d.automations ?? []) }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (id: string, method: "PATCH" | "DELETE", body?: Record<string, unknown>) => {
    await fetch(`/api/automations/${id}`, {
      method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined,
    })
    if (method === "DELETE" && open === id) setOpen(null)
    load()
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-white/40"><Loader2 className="size-4 animate-spin" />Loading…</div>
  if (items.length === 0) {
    return (
      <p className="text-sm text-white/45">
        No automations yet. Set one up by asking in chat — e.g. <span className="text-white/70">“check my mail 24/7 and reply professionally.”</span>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((a) => (
        <div key={a.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3 p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              {a.services.includes("drive") && !a.services.includes("gmail") ? <FolderOpen className="size-4 text-white/60" /> : <Mail className="size-4 text-white/60" />}
            </span>
            <button onClick={() => setOpen(open === a.id ? null : a.id)} className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-white">{a.name}</span>
                <span className={`size-1.5 rounded-full shadow-[0_0_7px] ${a.status === "running" ? "bg-emerald-400 shadow-emerald-400/60" : a.status === "paused" ? "bg-amber-400 shadow-amber-400/60" : "bg-white/30 shadow-transparent"}`} />
              </div>
              <p className="truncate text-[11.5px] text-white/40">
                {(a.stats.repliesSent ?? 0) > 0 ? `${a.stats.repliesSent} replies · ` : ""}
                {(a.stats.filesSaved ?? 0) > 0 ? `${a.stats.filesSaved} files · ` : ""}
                {(a.stats.digests ?? 0) > 0 ? `${a.stats.digests} digests · ` : ""}
                last action {rel(a.lastActionAt)}
              </p>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              {a.status === "running"
                ? <IconBtn title="Pause" onClick={() => act(a.id, "PATCH", { status: "paused" })}><Pause className="size-3.5" /></IconBtn>
                : <IconBtn title="Resume" onClick={() => act(a.id, "PATCH", { status: "running" })}><Play className="size-3.5" /></IconBtn>}
              <IconBtn title="Remove" danger onClick={() => { if (confirm(`Delete "${a.name}"?`)) act(a.id, "DELETE") }}><Trash2 className="size-3.5" /></IconBtn>
              <button onClick={() => setOpen(open === a.id ? null : a.id)} className="flex size-8 items-center justify-center rounded-full text-white/40 hover:text-white">
                <ChevronDown className={`size-4 transition-transform ${open === a.id ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
          {open === a.id && <Detail automation={a} />}
        </div>
      ))}
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`flex size-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors hover:bg-white/10 hover:text-white ${danger ? "hover:border-red-400/40 hover:text-red-300" : ""}`}>
      {children}
    </button>
  )
}

function Detail({ automation }: { automation: Automation }) {
  const a = automation
  const [events, setEvents] = useState<Evt[]>([])
  const [q, setQ] = useState("")
  const [ans, setAns] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    ;(async () => {
      try { const r = await fetch(`/api/automations/${a.id}/events`); if (r.ok) { const d = await r.json(); setEvents(d.events ?? []) } } catch { /* ignore */ }
    })()
  }, [a.id])

  const ask = async () => {
    const question = q.trim(); if (!question || asking) return
    setAsking(true); setAns(null)
    try {
      const r = await fetch(`/api/automations/${a.id}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) })
      const d = await r.json(); setAns(d.answer ?? d.error ?? "No answer.")
    } catch { setAns("Something went wrong.") } finally { setAsking(false) }
  }

  return (
    <div className="border-t border-white/[0.06] p-3.5">
      <p className="mb-2 text-[12px] text-white/50">{a.prompt}</p>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <Sparkles className="size-3.5 shrink-0 text-white/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask() }}
          placeholder="Ask what it's done…" className="flex-1 bg-transparent text-[12.5px] text-white outline-none placeholder:text-white/30" />
        <button onClick={ask} disabled={asking || !q.trim()} className="flex size-6 items-center justify-center rounded-full bg-white text-black disabled:opacity-40">
          {asking ? <Loader2 className="size-3 animate-spin" /> : <ArrowUp className="size-3" />}
        </button>
      </div>
      {ans && <p className="mb-3 whitespace-pre-wrap rounded-xl bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/70">{ans}</p>}

      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35"><Activity className="size-3" />Activity</p>
      {events.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[12px] text-white/35"><Clock className="size-3.5" />{a.status === "running" ? "Watching… nothing yet." : "No activity yet."}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {events.slice(0, 30).map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-[12px]">
              <span className={`mt-0.5 shrink-0 ${e.status === "success" ? "text-emerald-400" : e.status === "error" ? "text-red-400" : e.status === "pending" ? "text-amber-400" : "text-white/30"}`}>
                {e.status === "success" ? <Check className="size-3.5" /> : e.status === "error" ? <X className="size-3.5" /> : e.status === "pending" ? <Clock className="size-3.5" /> : <Activity className="size-3.5" />}
              </span>
              <span className="flex-1 text-white/70">{e.title}</span>
              <span className="shrink-0 text-white/25">{rel(e.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
