"use client"

import { useEffect, useRef, useState } from "react"
import { X, Download, Check, Loader2, Pencil, Eye } from "lucide-react"
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
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const [save, setSave] = useState<SaveState>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When the agent pushes a new or revised draft, replace the canvas contents.
  useEffect(() => {
    setTitle(draft.title)
    setContent(draft.content)
    setSave("idle")
  }, [draft.id, draft.title, draft.content])

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
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            queueSave(e.target.value, content)
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Untitled draft"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            {save === "saving" ? (
              <><Loader2 className="size-3 animate-spin" /> Saving…</>
            ) : save === "saved" ? (
              <><Check className="size-3 text-emerald-400/80" /> Saved</>
            ) : null}
          </span>
          <button
            onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={mode === "edit" ? "Preview" : "Edit"}
          >
            {mode === "edit" ? <><Eye className="size-3.5" /> Preview</> : <><Pencil className="size-3.5" /> Edit</>}
          </button>
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

      {mode === "edit" ? (
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            queueSave(title, e.target.value)
          }}
          spellCheck
          className="flex-1 resize-none bg-transparent px-6 py-5 font-serif text-[15px] leading-7 text-foreground/90 outline-none"
          placeholder="Start writing…"
        />
      ) : (
        <div className="prose-chat flex-1 overflow-auto px-6 py-5 font-serif text-[15px] leading-7 text-foreground/90">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "*Nothing to preview yet.*"}</ReactMarkdown>
        </div>
      )}
    </aside>
  )
}
