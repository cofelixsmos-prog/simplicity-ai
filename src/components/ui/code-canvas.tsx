"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Download, Check, Loader2, Code2, Eye, RefreshCw, FileCode2 } from "lucide-react"

export interface ProjectFile {
  name: string
  content: string
}

export interface AppData {
  id: string
  title: string
  files: ProjectFile[]
  entry: string
}

type SaveState = "idle" | "saving" | "saved"

// ── Preview assembly ─────────────────────────────────────────────────────────
// The preview runs everything in one sandboxed iframe. Because the iframe has no
// real filesystem, we inline any LOCAL <link>/<script src> references into the
// entry HTML. External (http/CDN) references — React, Babel, etc. — are left as
// real network loads. This makes both vanilla and CDN-React projects "just run".

function findFile(files: ProjectFile[], ref: string): ProjectFile | undefined {
  const clean = ref.replace(/^\.?\//, "").trim()
  const base = clean.split("/").pop()
  return (
    files.find((f) => f.name === clean) ??
    files.find((f) => f.name === ref) ??
    files.find((f) => f.name.split("/").pop() === base)
  )
}

const isExternal = (ref: string) => /^(https?:)?\/\//i.test(ref)

function inlineHtml(html: string, files: ProjectFile[]): string {
  // Inline local stylesheets: <link rel="stylesheet" href="styles.css">
  let out = html.replace(/<link\b[^>]*?>/gi, (tag) => {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    const isStyle = /stylesheet/i.test(tag) || /\.css(\?|$)/i.test(href ?? "")
    if (!href || !isStyle || isExternal(href)) return tag
    const f = findFile(files, href)
    return f ? `<style>\n${f.content}\n</style>` : tag
  })
  // Inline local scripts, preserving attributes like type="text/babel":
  out = out.replace(
    /<script\b([^>]*?)\ssrc\s*=\s*["']([^"']+)["']([^>]*?)>\s*<\/script>/gi,
    (tag, pre: string, src: string, post: string) => {
      if (isExternal(src)) return tag
      const f = findFile(files, src)
      return f ? `<script${pre}${post}>\n${f.content}\n</script>` : tag
    }
  )
  return out
}

// Build the full standalone HTML document for the preview / download.
function buildDocument(files: ProjectFile[], entry: string): string {
  if (!files.length) return ""
  const entryFile = files.find((f) => f.name === entry) ?? files.find((f) => /\.html?$/i.test(f.name))
  if (entryFile && /\.html?$/i.test(entryFile.name)) return inlineHtml(entryFile.content, files)

  // Fallback: no HTML entry — scaffold a host page around the code files.
  const styles = files
    .filter((f) => /\.css$/i.test(f.name))
    .map((f) => `<style>\n${f.content}\n</style>`)
    .join("\n")
  const usesReact =
    files.some((f) => /\.(jsx|tsx)$/i.test(f.name)) || (!!entryFile && /\.(jsx|tsx)$/i.test(entryFile.name))

  if (usesReact) {
    const scripts = files
      .filter((f) => /\.(jsx|tsx|js)$/i.test(f.name))
      .map((f) => `<script type="text/babel" data-presets="react">\n${f.content}\n</script>`)
      .join("\n")
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
${styles}</head><body><div id="root"></div>
${scripts}</body></html>`
  }

  const scripts = files
    .filter((f) => /\.js$/i.test(f.name))
    .map((f) => `<script>\n${f.content}\n</script>`)
    .join("\n")
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body>${scripts}</body></html>`
}

// ── Code canvas ──────────────────────────────────────────────────────────────
// An editable, multi-file project with a live preview. Agent-built; the user can
// switch files, edit them, and watch the preview update. Edits autosave (debounced)
// to /api/apps/[id].
export function CodeCanvas({ app, onClose }: { app: AppData; onClose: () => void }) {
  const [title, setTitle] = useState(app.title)
  const [files, setFiles] = useState<ProjectFile[]>(app.files)
  const [entry, setEntry] = useState(app.entry)
  const [active, setActive] = useState(app.entry || app.files[0]?.name || "")
  const [view, setView] = useState<"code" | "preview">("preview")
  const [save, setSave] = useState<SaveState>("idle")
  const [doc, setDoc] = useState("")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When the agent pushes a new/rebuilt app, replace the canvas contents.
  useEffect(() => {
    setTitle(app.title)
    setFiles(app.files)
    setEntry(app.entry)
    setActive(app.entry || app.files[0]?.name || "")
    setView("preview")
    setSave("idle")
  }, [app.id, app.title, app.entry, app.files])

  // Rebuild the preview document shortly after edits settle (avoids thrash while typing).
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => setDoc(buildDocument(files, entry)), 400)
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [files, entry])

  const activeFile = useMemo(() => files.find((f) => f.name === active), [files, active])

  const queueSave = (nextTitle: string, nextFiles: ProjectFile[], nextEntry: string) => {
    setSave("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/apps/${app.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle, files: nextFiles, entry: nextEntry }),
        })
        setSave("saved")
      } catch {
        setSave("idle")
      }
    }, 700)
  }

  const editActive = (content: string) => {
    const next = files.map((f) => (f.name === active ? { ...f, content } : f))
    setFiles(next)
    queueSave(title, next, entry)
  }

  const refresh = () => setDoc(buildDocument(files, entry))

  const download = () => {
    const blob = new Blob([buildDocument(files, entry)], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(title || "app").replace(/[^\w.-]+/g, "_")}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <aside className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Code2 className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              queueSave(e.target.value, files, entry)
            }}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Untitled app"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="mr-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {save === "saving" ? (
              <><Loader2 className="size-3 animate-spin" /> Saving…</>
            ) : save === "saved" ? (
              <><Check className="size-3 text-emerald-400/80" /> Saved</>
            ) : null}
          </span>
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              onClick={() => setView("code")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                view === "code" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="size-3.5" /> Code
            </button>
            <button
              onClick={() => {
                refresh()
                setView("preview")
              }}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                view === "preview" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="size-3.5" /> Preview
            </button>
          </div>
          {view === "preview" && (
            <button
              onClick={refresh}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Refresh preview"
            >
              <RefreshCw className="size-4" />
            </button>
          )}
          <button
            onClick={download}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Download standalone .html"
          >
            <Download className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close app"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {view === "preview" ? (
        <iframe
          title="App preview"
          srcDoc={doc}
          className="min-h-0 flex-1 bg-white"
          sandbox="allow-scripts allow-popups allow-modals allow-forms allow-pointer-lock"
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* File tree */}
          <div className="w-40 shrink-0 overflow-y-auto border-r border-border py-2">
            {files.map((f) => (
              <button
                key={f.name}
                onClick={() => setActive(f.name)}
                className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs transition-colors ${
                  f.name === active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
                title={f.name}
              >
                <FileCode2 className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">{f.name}</span>
                {f.name === entry && (
                  <span className="ml-auto shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                    entry
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Editor */}
          <textarea
            value={activeFile?.content ?? ""}
            onChange={(e) => editActive(e.target.value)}
            spellCheck={false}
            wrap="off"
            className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/90 outline-none"
            placeholder="Select a file to edit…"
          />
        </div>
      )}
    </aside>
  )
}
