"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, X, Loader2, Code2, FileText, ArrowUpRight, Mail, Download } from "lucide-react"
import type { AppData } from "@/components/ui/code-canvas"
import type { DraftData } from "@/components/ui/draft-canvas"

interface ArtifactEntry {
  kind: "app" | "draft" | "email" | "file"
  id: string
  title: string
  conversationId: string
  createdAt: number
  data: AppData | DraftData | unknown
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? "yesterday" : `${d}d ago`
}

// A library of everything the user has ever created — apps and drafts, across
// every chat — so nothing is stranded in an old conversation. Opened from the
// top-right button; clicking an item reopens it in its canvas.
export function ArtifactsPanel({
  open,
  onClose,
  onOpenApp,
  onOpenDraft,
}: {
  open: boolean
  onClose: () => void
  onOpenApp: (a: AppData) => void
  onOpenDraft: (d: DraftData) => void
}) {
  const [items, setItems] = useState<ArtifactEntry[] | null>(null)

  useEffect(() => {
    if (!open) return
    setItems(null)
    fetch("/api/artifacts")
      .then((r) => (r.ok ? r.json() : { artifacts: [] }))
      .then((d) => setItems(d.artifacts ?? []))
      .catch(() => setItems([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const openItem = (a: ArtifactEntry) => {
    if (a.kind === "app") { onOpenApp(a.data as AppData); onClose() }
    else if (a.kind === "draft") { onOpenDraft(a.data as DraftData); onClose() }
    else if (a.kind === "file") {
      const f = a.data as { id?: string }
      if (f.id) window.open(`/api/uploads/${f.id}?download`, "_blank")
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[7vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="liquid-glass liquid-glass-soft relative z-10 flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <LayoutGrid className="size-4 text-white/70" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">Artifacts</div>
            <div className="text-[11px] text-white/45">Everything Simplicity has built for you, across all chats</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {items === null ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/45">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-white/45">
              No artifacts yet. When Simplicity builds an app or writes a document, it&apos;ll live here.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((a) => {
                const Icon = a.kind === "app" ? Code2 : a.kind === "email" ? Mail : a.kind === "file" ? Download : FileText
                const label = a.kind === "app" ? "App" : a.kind === "email" ? "Email" : a.kind === "file" ? "File" : "Document"
                return (
                  <button
                    key={a.id}
                    onClick={() => openItem(a)}
                    className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-white/70">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium text-white">{a.title}</span>
                        <ArrowUpRight className="size-3.5 shrink-0 text-white/0 transition-colors group-hover:text-white/50" />
                      </span>
                      <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-white/35">
                        {label} · {timeAgo(a.createdAt)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
