"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowUp,
  Loader2,
  Check,
  Copy,
  Plus,
  ChevronDown,
  Brain,
  Sparkles,
  Network,
  PenLine,
  Presentation,
  Cpu,
  Home,
  Code2,
  BookOpen,
  Command as CommandIcon,
  MessageSquare,
  Trash2,
  LogOut,
} from "lucide-react"
import { MessageContent, type Visual } from "@/components/ui/message-content"
import { ToolActivity, type Step } from "@/components/ui/tool-activity"
import { AgentSwarm, type AgentCard } from "@/components/ui/agent-swarm"
import { AgentPanel } from "@/components/ui/agent-panel"
import { VisualPanel } from "@/components/ui/visual-panel"
import { DraftCanvas, type DraftData } from "@/components/ui/draft-canvas"
import { CommandPalette, type Command } from "@/components/ui/command-palette"
import { type ConvoLite } from "@/components/ui/chat-sidebar"
import { ReasoningAura } from "@/components/ui/reasoning-aura"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { MODELS, DEFAULT_MODEL_ID, getModel } from "@/lib/models"

interface Message {
  role: "user" | "assistant"
  content: string
  steps?: Step[]
  agents?: AgentCard[]
}

type Reasoning = "off" | "low" | "medium" | "high"

// Time-aware greeting, with a little variety per slot.
function getGreeting(): string {
  const h = new Date().getHours()
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

  if (h >= 5 && h < 12)
    return pick([
      "Good morning",
      "Morning",
      "Rise and shine",
      "A fresh start",
    ])
  if (h >= 12 && h < 17)
    return pick([
      "Good afternoon",
      "Afternoon",
      "Hope your day's going well",
    ])
  if (h >= 17 && h < 22)
    return pick([
      "Good evening",
      "Evening",
      "Winding down?",
    ])
  return pick([
    "Late night session, huh?",
    "Burning the midnight oil?",
    "Still up?",
    "The quiet hours",
  ])
}

// Playful, never-leak-the-real-error messages shown when a request fails.
const COLLAPSE_MESSAGES = [
  "uh… Simplicity? hello?",
  "it looks like he collapsed 💀",
  "yo, chill on the rate limit",
  "Simplicity has left the chat (temporarily)",
  "uh, idk, there's an error",
  "if you're reading this, Simplicity is dead. please report this bug to the Simplicity report.",
  "brb, Simplicity is taking a nap",
  "404: Simplicity not found (he'll be back)",
  "Simplicity fainted. use a Potion?",
  "something broke and it definitely wasn't your fault (it was)",
  "the hamster powering Simplicity stopped running",
  "Simplicity blue-screened. give it a sec.",
  "error: too much intelligence, not enough complexity",
  "hold on, Simplicity is rebooting his brain",
  "we ran out of thoughts. try again in a bit.",
  "Simplicity.exe has stopped responding",
  "oops. pretend you didn't see that.",
  "Simplicity is buffering… please hold",
  "he's down bad rn, try again shortly",
  "system says no. try again later 🙏",
]

function collapseMessage(): string {
  return (
    "⚠️ " +
    COLLAPSE_MESSAGES[Math.floor(Math.random() * COLLAPSE_MESSAGES.length)]
  )
}

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
  const [panelDraft, setPanelDraft] = useState<DraftData | null>(null)
  // Index of the message whose sub-agents are shown (live) in the side panel.
  const [agentPanelIdx, setAgentPanelIdx] = useState<number | null>(null)
  const [auraTrigger, setAuraTrigger] = useState(0)
  const [greeting, setGreeting] = useState("")
  const [thinking, setThinking] = useState(false)
  // Track which assistant message indices have had their questions answered / plan decided.
  const [answeredIdx, setAnsweredIdx] = useState<Set<number>>(new Set())
  const [planDecisions, setPlanDecisions] = useState<Record<number, "approved" | "denied">>({})
  // Auth + chat history
  const [user, setUser] = useState<{ email: string; name: string | null } | null | undefined>(undefined)
  const [conversations, setConversations] = useState<ConvoLite[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)

  // Compute greeting on the client only (avoids SSR/hydration mismatch).
  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  // Require auth; load the user and their conversations.
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me")
        const d = await res.json()
        if (!d.user) {
          window.location.href = "/login"
          return
        }
        setUser({ email: d.user.email, name: d.user.name })
        const cr = await fetch("/api/conversations")
        if (cr.ok) setConversations((await cr.json()).conversations ?? [])
      } catch {
        window.location.href = "/login"
      }
    })()
  }, [])

  // Fire the activation flash when "high" reasoning is selected.
  const chooseReasoning = (r: Reasoning) => {
    setReasoning(r)
    if (r === "high") setAuraTrigger((n) => n + 1)
  }

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
    setPanelDraft(null)
    setAgentPanelIdx(null)
    setConversationId(null)
  }

  const refreshConversations = async () => {
    try {
      const r = await fetch("/api/conversations")
      if (r.ok) setConversations((await r.json()).conversations ?? [])
    } catch {}
  }

  const loadConversation = async (id: string) => {
    if (loading) return
    setPanelVisual(null)
    setPanelDraft(null)
    setAgentPanelIdx(null)
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) return
      const d = await res.json()
      setMessages(
        (d.messages ?? []).map((m: { role: "user" | "assistant"; content: string }) => ({
          role: m.role,
          content: m.content,
        }))
      )
      setConversationId(id)
    } catch {}
  }

  const deleteConvo = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" })
    } catch {}
    setConversations((c) => c.filter((x) => x.id !== id))
    if (conversationId === id) reset()
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    window.location.href = "/login"
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const next: Message[] = [...messages, { role: "user", content: trimmed }]
    setMessages(next)
    setInput("")
    setLoading(true)
    setThinking(false)
    setMessages((m) => [...m, { role: "assistant", content: "" }])

    // Ensure a conversation exists, then persist the user message (best-effort).
    let convoId = conversationId
    if (!convoId) {
      try {
        const cr = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed.slice(0, 60) }),
        })
        if (cr.ok) {
          const cd = await cr.json()
          convoId = cd.conversation.id
          setConversationId(convoId)
          setConversations((c) => [cd.conversation, ...c])
        }
      } catch {}
    }
    if (convoId)
      fetch(`/api/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: trimmed }),
      }).catch(() => {})

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
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: "assistant", content: collapseMessage() }
          return copy
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let acc = ""
      const steps: Step[] = []
      const agents: AgentCard[] = []

      // Replace the trailing assistant placeholder with the latest text/steps/agents.
      const flush = () => {
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = {
            role: "assistant",
            content: acc,
            steps: steps.length ? [...steps] : undefined,
            agents: agents.length ? agents.map((a) => ({ ...a, steps: [...a.steps] })) : undefined,
          }
          return copy
        })
      }

      // The server streams NDJSON events, one JSON object per line.
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const t = line.trim()
          if (!t) continue
          let ev: {
            t: string
            v?: string
            id?: string
            tool?: string
            label?: string
            status?: Step["status"]
            detail?: string
            title?: string
            content?: string
            name?: string
            task?: string
            summary?: string
            agentId?: string
          }
          try {
            ev = JSON.parse(t)
          } catch {
            continue
          }

          if (ev.t === "thinking") {
            setThinking(true)
          } else if (ev.t === "agent") {
            // A sub-agent's lifecycle: spawned / finished / errored.
            setThinking(false)
            const i = agents.findIndex((a) => a.id === ev.id)
            const card: AgentCard = {
              id: ev.id ?? "",
              name: ev.name ?? "Agent",
              task: ev.task ?? (i >= 0 ? agents[i].task : ""),
              status: ev.status ?? "running",
              steps: i >= 0 ? agents[i].steps : [],
              summary: ev.summary ?? (i >= 0 ? agents[i].summary : undefined),
            }
            if (i >= 0) agents[i] = card
            else agents.push(card)
            flush()
          } else if (ev.t === "agent_step") {
            // A tool step inside a specific sub-agent.
            const ai = agents.findIndex((a) => a.id === ev.agentId)
            if (ai >= 0) {
              const st: Step = {
                id: ev.id ?? "",
                tool: ev.tool ?? "",
                label: ev.label ?? "",
                status: ev.status ?? "running",
                detail: ev.detail,
              }
              const si = agents[ai].steps.findIndex((s) => s.id === st.id)
              if (si >= 0) agents[ai].steps[si] = st
              else agents[ai].steps.push(st)
              flush()
            }
          } else if (ev.t === "draft") {
            // The agent opened/updated a draft — show it in the editable canvas.
            setPanelVisual(null)
            setAgentPanelIdx(null)
            setPanelDraft({
              id: ev.id ?? "",
              title: ev.title ?? "Untitled draft",
              content: ev.content ?? "",
            })
          } else if (ev.t === "text") {
            acc += ev.v ?? ""
            if (acc.trim().length > 0) setThinking(false)
            flush()
          } else if (ev.t === "step") {
            setThinking(false)
            const next: Step = {
              id: ev.id ?? "",
              tool: ev.tool ?? "",
              label: ev.label ?? "",
              status: ev.status ?? "running",
              detail: ev.detail,
            }
            const idx = steps.findIndex((s) => s.id === next.id)
            if (idx >= 0) steps[idx] = next
            else steps.push(next)
            flush()
          } else if (ev.t === "error") {
            setThinking(false)
            const friendly = collapseMessage()
            setMessages((m) => {
              const copy = [...m]
              copy[copy.length - 1] = { role: "assistant", content: friendly }
              return copy
            })
            return
          }
        }
      }

      // Persist the assistant's final answer, then refresh the sidebar order.
      if (convoId && acc.trim()) {
        fetch(`/api/conversations/${convoId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: acc }),
        })
          .then(() => refreshConversations())
          .catch(() => {})
      }
    } catch {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = { role: "assistant", content: collapseMessage() }
        return copy
      })
    } finally {
      setLoading(false)
      setThinking(false)
    }
  }

  // Interactive-block handlers (questions / plan)
  const handleAnswers = (idx: number, text: string) => {
    setAnsweredIdx((s) => new Set(s).add(idx))
    send(`Here are my answers:\n${text}`)
  }
  const handleApprove = (idx: number) => {
    setPlanDecisions((d) => ({ ...d, [idx]: "approved" }))
    send("[User approved the plan] Please proceed.")
  }
  const handleDeny = (idx: number) => {
    setPlanDecisions((d) => ({ ...d, [idx]: "denied" }))
    send("[User denied the plan] Please ask what to change.")
  }

  // Prefill the composer with a starter prompt and focus it (used by ⌘K).
  const prefill = (text: string) => {
    setInput(text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(text.length, text.length)
      }
    })
  }

  // ⌘K command palette commands.
  const commands: Command[] = [
    { id: "new", group: "Actions", label: "New chat", icon: Plus, keywords: "reset clear", run: reset },
    ...conversations.slice(0, 8).map((c) => ({
      id: `c-${c.id}`,
      group: "Recent chats",
      label: c.title,
      icon: MessageSquare,
      keywords: "history conversation past",
      run: () => loadConversation(c.id),
    })),
    {
      id: "p-ppt",
      group: "Start",
      label: "Make a presentation",
      icon: Presentation,
      keywords: "ppt deck slides",
      run: () => prefill("Make a professional presentation about "),
    },
    {
      id: "p-research",
      group: "Start",
      label: "Research with sub-agents",
      icon: Network,
      keywords: "agents swarm search",
      run: () => prefill("Research the following using sub-agents: "),
    },
    {
      id: "p-essay",
      group: "Start",
      label: "Write an essay / draft",
      icon: PenLine,
      keywords: "write document draft",
      run: () => prefill("Write an essay about "),
    },
    {
      id: "p-diagram",
      group: "Start",
      label: "Create a diagram",
      icon: Sparkles,
      keywords: "flowchart mermaid chart svg",
      run: () => prefill("Create a diagram of "),
    },
    ...MODELS.map((m) => ({
      id: `model-${m.id}`,
      group: "Model",
      label: `Use ${m.name}`,
      icon: Cpu,
      hint: m.id === modelId ? "active" : m.label,
      keywords: `${m.label} ${m.description}`,
      run: () => setModelId(m.id),
    })),
    ...(model.supportsReasoning
      ? (["off", "low", "medium", "high"] as Reasoning[]).map((r) => ({
          id: `reason-${r}`,
          group: "Reasoning",
          label: `Reasoning: ${r}`,
          icon: Brain,
          hint: reasoning === r ? "active" : undefined,
          run: () => chooseReasoning(r),
        }))
      : []),
    { id: "go-home", group: "Go to", label: "Home", icon: Home, run: () => (window.location.href = "/") },
    { id: "go-dev", group: "Go to", label: "Developers", icon: Code2, run: () => (window.location.href = "/developers") },
    { id: "go-res", group: "Go to", label: "Resources", icon: BookOpen, run: () => (window.location.href = "/resources") },
    ...(conversationId
      ? [{ id: "del", group: "Account", label: "Delete this chat", icon: Trash2, run: () => deleteConvo(conversationId) } as Command]
      : []),
    { id: "logout", group: "Account", label: "Log out", icon: LogOut, keywords: "sign out", run: logout },
  ]

  const empty = messages.length === 0

  // While auth resolves, show a minimal loader (redirects to /login if signed out).
  if (user === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-white/40" />
      </div>
    )
  }

  return (
    <div className="relative flex h-dvh">
      {/* Same animated shader background as the landing page */}
      <ShaderBackground fixed />
      <LiquidGlassFilters />

      {/* ⌘K command palette */}
      <CommandPalette commands={commands} />

      {/* Apple-Intelligence-style activation flash when "high" is selected */}
      <ReasoningAura trigger={auraTrigger} />

      {/* ── Chat column ── */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Minimal floating top: just the brand + new chat */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4">
          <a
            href="/"
            className="pointer-events-auto flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white/90 transition-colors hover:text-white"
          >
            <span className="size-1.5 rounded-full bg-white/80" />
            Simplicity
          </a>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => window.dispatchEvent(new Event("open-cmdk"))}
              aria-label="Open command palette"
              title="Command palette"
              className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <CommandIcon className="size-3.5" />
              <span className="font-mono">K</span>
            </button>
            {!empty && (
              <button
                onClick={reset}
                aria-label="New chat"
                title="New chat"
                className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages (only once a conversation has started) */}
        {!empty && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
            <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-20">
              <div className="space-y-8">
                {messages.map((m, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {m.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="liquid-glass max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed text-white">
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
                          {m.steps && m.steps.length > 0 && (
                            <ToolActivity steps={m.steps} />
                          )}
                          {m.agents && m.agents.length > 0 && (
                            <AgentSwarm
                              agents={m.agents}
                              onOpen={() => {
                                setPanelDraft(null)
                                setPanelVisual(null)
                                setAgentPanelIdx(i)
                              }}
                            />
                          )}
                          {m.content ? (
                            <>
                              <MessageContent
                                content={m.content}
                                streaming={loading && i === messages.length - 1}
                                onExpand={(v) => {
                                  setPanelDraft(null)
                                  setAgentPanelIdx(null)
                                  setPanelVisual(v)
                                }}
                                onAnswerQuestions={(t) => handleAnswers(i, t)}
                                onApprovePlan={() => handleApprove(i)}
                                onDenyPlan={() => handleDeny(i)}
                                questionsAnswered={answeredIdx.has(i)}
                                planDecision={planDecisions[i] ?? null}
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
                          ) : thinking && i === messages.length - 1 ? (
                            <div className="flex items-center gap-2 pt-1">
                              <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                              <span className="animate-pulse text-sm text-white/60">
                                Thinking…
                              </span>
                            </div>
                          ) : (m.steps && m.steps.length > 0) ||
                            (m.agents && m.agents.length > 0) ? null : (
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
            </div>
          </div>
        )}

        {/* Composer — centered hero when empty, pinned to bottom in a chat */}
        <div
          className={
            empty
              ? "flex flex-1 flex-col items-center justify-center px-4"
              : "px-4 pb-5 pt-2"
          }
        >
          {empty && (
            <div className="mb-9 flex flex-col items-center text-center">
              <div className="anim-rise text-[10px] tracking-[0.6em] text-white/25" style={{ ["--delay" as string]: "0ms" }}>
                ✦ ✦ ✦
              </div>
              <h1 className="anim-rise mt-6 text-4xl font-semibold tracking-tight text-white sm:text-[44px]" style={{ ["--delay" as string]: "100ms" }}>
                {greeting || " "}
              </h1>
              <p className="anim-rise mt-3 text-[15px] text-white/55" style={{ ["--delay" as string]: "220ms" }}>
                What can I help you build?
              </p>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className={empty ? "w-full max-w-2xl" : "mx-auto w-full max-w-3xl"}
          >
            <div className="liquid-glass flex w-full flex-col gap-2 rounded-[28px] px-4 pb-2.5 pt-3 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out focus-within:border-white/25 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_24px_64px_-16px_rgba(0,0,0,0.75)]">
              {/* input row */}
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
                className="max-h-52 min-h-[28px] w-full resize-none bg-transparent px-1 py-1 text-base leading-relaxed text-white placeholder:text-white/40 focus:outline-none"
              />

              {/* toolbar row: controls left, send right */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Model picker (opens upward) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelMenu((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <span className="font-mono">{model.label}</span>
                      <ChevronDown className="size-3.5 text-white/50" />
                    </button>
                    {modelMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setModelMenu(false)} />
                        <div className="liquid-glass liquid-glass-soft absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-2xl p-1 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ease-out">
                          {MODELS.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setModelId(m.id)
                                setModelMenu(false)
                              }}
                              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/10 ${
                                m.id === modelId ? "bg-white/10" : ""
                              }`}
                            >
                              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-white/20 font-mono text-[11px] text-white">
                                {m.label}
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                                  {m.name}
                                  {m.supportsReasoning && <Brain className="size-3 text-white/50" />}
                                </span>
                                <span className="block text-xs text-white/50">{m.description}</span>
                              </span>
                              {m.id === modelId && <Check className="ml-auto mt-1 size-4 text-white" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Reasoning selector */}
                  {model.supportsReasoning && (
                    <div className="hidden items-center gap-0.5 rounded-full border border-white/15 p-0.5 sm:flex">
                      <Brain
                        className={`ml-1.5 size-3.5 transition-colors ${
                          reasoning !== "off" ? "text-white" : "text-white/50"
                        }`}
                      />
                      {(["off", "low", "medium", "high"] as Reasoning[]).map((r) => {
                        const active = reasoning === r
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => chooseReasoning(r)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                              active && r === "high"
                                ? "bg-white text-black shadow-[0_0_16px_-2px_rgba(255,255,255,0.5)]"
                                : active
                                  ? "bg-white text-black"
                                  : "text-white/55 hover:text-white"
                            }`}
                          >
                            {r}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Send"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 disabled:scale-100 disabled:opacity-30"
                >
                  {loading ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.5} />}
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-center text-xs text-white/40">Simplicity can make mistakes.</p>
          </form>
        </div>
      </div>

      {/* ── Right side pane: agents / draft / visual ── */}
      {(() => {
        const agentMsg = agentPanelIdx !== null ? messages[agentPanelIdx] : null
        const showAgents = !!agentMsg?.agents?.length
        const open = showAgents || !!panelDraft || !!panelVisual
        if (!open) return null
        const body = showAgents ? (
          <AgentPanel agents={agentMsg!.agents!} onClose={() => setAgentPanelIdx(null)} />
        ) : panelDraft ? (
          <DraftCanvas draft={panelDraft} onClose={() => setPanelDraft(null)} />
        ) : panelVisual ? (
          <VisualPanel visual={panelVisual} onClose={() => setPanelVisual(null)} />
        ) : null
        return (
          <>
            <div className="relative z-10 hidden w-[44%] max-w-[640px] shrink-0 p-3 md:block animate-in fade-in slide-in-from-right-4 duration-500 ease-out">
              <div className="liquid-glass liquid-glass-soft h-full overflow-hidden rounded-2xl">{body}</div>
            </div>
            <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xl md:hidden animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
              {body}
            </div>
          </>
        )
      })()}
    </div>
  )
}
