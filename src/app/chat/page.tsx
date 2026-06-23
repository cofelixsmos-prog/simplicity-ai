"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowUp,
  Loader2,
  Check,
  Copy,
  GitBranch,
  Network,
  Workflow,
  Plus,
  ChevronDown,
  Brain,
  Box,
} from "lucide-react"
import { MessageContent, type Visual } from "@/components/ui/message-content"
import { VisualPanel } from "@/components/ui/visual-panel"
import { MODELS, DEFAULT_MODEL_ID, getModel } from "@/lib/models"

interface Message {
  role: "user" | "assistant"
  content: string
}

type Reasoning = "off" | "low" | "medium" | "high"

const SUGGESTIONS = [
  { icon: Workflow, title: "User login flow", prompt: "Draw a flowchart of a user login process" },
  { icon: Box, title: "Jet engine cutaway", prompt: "Draw a labeled 2D cutaway illustration of a jet engine with color" },
  { icon: GitBranch, title: "API request sequence", prompt: "Create a sequence diagram for an API request" },
  { icon: Network, title: "3D solar system", prompt: "Make a 3D model of the inner solar system" },
]

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-lg bg-foreground text-background ${className}`}>
      <span className="text-[11px] font-bold tracking-tight">S</span>
    </span>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID)
  const [reasoning, setReasoning] = useState<Reasoning>("medium")
  const [modelMenu, setModelMenu] = useState(false)
  const [panelVisual, setPanelVisual] = useState<Visual | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const model = getModel(modelId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 180) + "px"
  }, [input])

  const copy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const reset = () => {
    setMessages([])
    setInput("")
    setPanelVisual(null)
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const next: Message[] = [...messages, { role: "user", content: trimmed }]
    setMessages(next)
    setInput("")
    setLoading(true)
    setMessages((m) => [...m, { role: "assistant", content: "" }])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          model: modelId,
          reasoning: model.supportsReasoning ? reasoning : "off",
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed." }))
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${err.error ?? "Something went wrong."}` }
          return copy
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: "assistant", content: acc }
          return copy
        })
      }
    } catch {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = { role: "assistant", content: "⚠️ Network error. Please try again." }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }

  const empty = messages.length === 0

  return (
    <div className="flex h-dvh bg-background">
      {/* ── Chat column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-5 py-3 backdrop-blur-xl">
          <a href="/" className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-foreground">
            <span className="size-1.5 rounded-full bg-white/80" />
            Simplicity
          </a>

          <div className="flex items-center gap-2">
            {/* Model picker */}
            <div className="relative">
              <button
                onClick={() => setModelMenu((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-secondary"
              >
                <span className="font-mono">{model.label}</span>
                <span className="hidden text-muted-foreground sm:inline">{model.description}</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
              {modelMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setModelMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setModelId(m.id)
                          setModelMenu(false)
                        }}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary ${
                          m.id === modelId ? "bg-secondary" : ""
                        }`}
                      >
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-mono text-[11px] text-foreground">
                          {m.label}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            {m.name}
                            {m.supportsReasoning && <Brain className="size-3 text-muted-foreground" />}
                          </span>
                          <span className="block text-xs text-muted-foreground">{m.description}</span>
                        </span>
                        {m.id === modelId && <Check className="ml-auto mt-1 size-4 text-foreground" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Reasoning selector — only for reasoning-capable models */}
            {model.supportsReasoning && (
              <div className="hidden items-center gap-1 rounded-full border border-border p-0.5 sm:flex">
                <Brain className="ml-1.5 size-3.5 text-muted-foreground" />
                {(["off", "low", "medium", "high"] as Reasoning[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setReasoning(r)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                      reasoning === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-8">
            {empty ? (
              <div className="flex flex-col items-center justify-center pt-14 text-center sm:pt-20">
                <LogoMark className="size-12 rounded-2xl [&_span]:text-lg" />
                <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">What can I help you build?</h1>
                <p className="mt-2.5 text-[15px] text-muted-foreground">
                  Ask anything — I can draw flowcharts, colored 2D illustrations, and 3D models.
                </p>
                <div className="mt-10 grid w-full gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.title}
                      onClick={() => send(s.prompt)}
                      className="group flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-card"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                        <s.icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-foreground">{s.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{s.prompt}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {messages.map((m, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {m.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed text-foreground">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <div className="group flex gap-3.5">
                        <LogoMark className="mt-0.5 size-7 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-foreground">Simplicity</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{model.label}</span>
                          </div>
                          {m.content ? (
                            <>
                              <MessageContent
                                content={m.content}
                                streaming={loading && i === messages.length - 1}
                                onExpand={setPanelVisual}
                              />
                              {!(loading && i === messages.length - 1) && (
                                <button
                                  onClick={() => copy(m.content, i)}
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100"
                                >
                                  {copiedIdx === i ? (
                                    <><Check className="size-3.5" /> Copied</>
                                  ) : (
                                    <><Copy className="size-3.5" /> Copy</>
                                  )}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 pt-1">
                              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="bg-gradient-to-t from-background via-background to-transparent px-4 pb-5 pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="mx-auto w-full max-w-3xl"
          >
            <div className="flex items-end gap-2 rounded-[26px] border border-border bg-card/80 p-2 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-colors focus-within:border-white/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={1}
                placeholder="Ask Simplicity anything…"
                className="max-h-44 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:scale-105 disabled:scale-100 disabled:opacity-25"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
              </button>
            </div>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">Simplicity can make mistakes.</p>
          </form>
        </div>
      </div>

      {/* ── Right visual pane ── */}
      {panelVisual && (
        <div className="hidden w-[44%] max-w-[640px] shrink-0 md:block">
          <VisualPanel visual={panelVisual} onClose={() => setPanelVisual(null)} />
        </div>
      )}

      {/* Mobile: full-screen overlay panel */}
      {panelVisual && (
        <div className="fixed inset-0 z-40 bg-background md:hidden">
          <VisualPanel visual={panelVisual} onClose={() => setPanelVisual(null)} />
        </div>
      )}
    </div>
  )
}
