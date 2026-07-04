"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Download, Check, Loader2, Pencil, Eye, FileText } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export interface DraftData {
  id: string
  title: string
  content: string
}

type SaveState = "idle" | "saving" | "saved"

// An editable document canvas for agent-written drafts/essays. Edits autosave
// (debounced) back to the DB via /api/drafts/[id].
export function DraftCanvas({ draft, onClose }: { draft: DraftData; onClose: () => void }) {
  const [title, setTitle] = useState(draft.title)
  const [content, setContent] = useState(draft.content)
  const [mode, setMode] = useState<"edit" | "preview">("preview")
  const [save, setSave] = useState<SaveState>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When the agent pushes a new or revised draft, replace the canvas contents.
  useEffect(() => {
    setTitle(draft.title)
    setContent(draft.content)
    setMode("preview")
    setSave("idle")
  }, [draft.id, draft.title, draft.content])

  const words = useMemo(() => (content.trim() ? content.trim().split(/\s+/).length : 0), [content])
  const readMins = Math.max(1, Math.round(words / 200))

  const queueSave = (nextTitle: string, nextContent: string) => {
    setSave("saving")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await fetch(`/api/drafts/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle, content: nextContent }),
        })
        setSave("saved")
      } catch {
        setSave("idle")
      }
    }, 700)
  }

  const download = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(title || "draft").replace(/[^\w.-]+/g, "_")}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <aside className="flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <FileText className="size-3.5" />
          Document
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="mr-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {save === "saving" ? (
              <><Loader2 className="size-3 animate-spin" /> Saving…</>
            ) : save === "saved" ? (
              <><Check className="size-3 text-emerald-400/80" /> Saved</>
            ) : null}
          </span>
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              onClick={() => setMode("edit")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                mode === "edit" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Pencil className="size-3.5" /> Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                mode === "preview" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="size-3.5" /> Read
            </button>
          </div>
          <button
            onClick={download}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Download .md"
          >
            <Download className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close draft"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Document body — a centered reading column for a real "page" feel */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[680px] px-8 py-9 sm:px-10">
          {/* Title + meta */}
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              queueSave(e.target.value, content)
            }}
            className="w-full bg-transparent font-serif text-[28px] font-semibold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60"
            placeholder="Untitled"
          />
          <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>{words.toLocaleString()} words</span>
            <span className="opacity-40">·</span>
            <span>{readMins} min read</span>
          </div>
          <div className="mt-5 h-px bg-border" />

          {/* Content */}
          {mode === "edit" ? (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                queueSave(title, e.target.value)
              }}
              spellCheck
              className="mt-6 min-h-[55vh] w-full resize-none bg-transparent font-serif text-[16px] leading-8 text-foreground/90 outline-none placeholder:text-muted-foreground/50"
              placeholder="Start writing…"
            />
          ) : (
            <div className="prose-chat mt-6 font-serif text-[16px] leading-8 text-foreground/90">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || "*Nothing to preview yet.*"}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
