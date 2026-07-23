"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowUp,
  ArrowDown,
  Square,
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
  Moon,
  Trash2,
  LogOut,
  Paperclip,
  FileText,
  X,
  Loader2,
  Mail,
  Focus,
  LayoutGrid,
  Settings,
} from "lucide-react"
import { MessageContent, type Visual } from "@/components/ui/message-content"
import { PdfBlock, type PdfSpec } from "@/components/ui/pdf-block"
import { ToolActivity, type Step } from "@/components/ui/tool-activity"
import { AgentSwarm, type AgentCard } from "@/components/ui/agent-swarm"
import { AgentPanel } from "@/components/ui/agent-panel"
import { VisualPanel } from "@/components/ui/visual-panel"
import { DraftCanvas, type DraftData } from "@/components/ui/draft-canvas"
import { CodeCanvas, type AppData } from "@/components/ui/code-canvas"
import { EmailApprovalCard, type StagedEmail } from "@/components/ui/email-card"
import { InboxCard, DeleteEmailCard, type InboxItem, type DeleteItem } from "@/components/ui/email-inbox-card"
import { InactivityDim } from "@/components/ui/inactivity-dim"
import { DictionaryLookup } from "@/components/ui/dictionary-lookup"
import { MemoryPanel } from "@/components/ui/memory-panel"
import { ChatsPanel } from "@/components/ui/chats-panel"
import { ArtifactsPanel } from "@/components/ui/artifacts-panel"
import { FocusBar } from "@/components/ui/focus-bar"
import { AmbientSound } from "@/components/ui/ambient-sound"
import { StatusBoard } from "@/components/ui/status-board"
import { CommandPalette, type Command } from "@/components/ui/command-palette"
import { type ConvoLite } from "@/components/ui/chat-sidebar"
import { ReasoningAura } from "@/components/ui/reasoning-aura"
import { ShaderBackground, type BgStatus } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { Splash } from "@/components/ui/splash"
import { Tooltip } from "@/components/ui/tooltip"
import { MicButton } from "@/components/ui/mic-button"
import { toast } from "@/components/ui/toast"
import { playSend, playDone, playType, playBackspace } from "@/lib/sound"
import { MODELS, DEFAULT_MODEL_ID, getModel } from "@/lib/models"
import { parseSettings, mirrorSettingsToLocal, readLocalFlag, LS_AUTO_NIGHT, LS_AUTO_MORNING, DEFAULT_SETTINGS } from "@/lib/settings"

interface Message {
  role: "user" | "assistant"
  content: string
  steps?: Step[]
  agents?: AgentCard[]
  attachments?: { name: string }[]
  // Email(s) the AI staged for approval, rendered as an inline approval card.
  email?: StagedEmail[]
  // Inbox listing (read_emails) rendered as a read-only card.
  inbox?: InboxItem[]
  // Emails staged for deletion, rendered as a Trash-confirmation card.
  deleteEmails?: DeleteItem[]
  // Artifacts produced this message, kept so they can be reopened any time
  // (not just when first created).
  app?: AppData
  draft?: DraftData
  // A generated file (e.g. a create_pdf result) offered as a download. When the
  // file is a PDF, `spec` carries the same document-block JSON as the inline
  // ```pdf preview so it renders identically (title/blocks + a real download).
  file?: { id: string; name: string; mime?: string; size?: number; spec?: PdfSpec }
  // ALL files produced this message (multiple create_pdf/create_ppt calls). The
  // singular `file` above is kept for backward-compat with older persisted rows;
  // new messages populate this array so a second file never replaces the first.
  files?: { id: string; name: string; mime?: string; size?: number; spec?: PdfSpec }[]
  // Whether the staged email was already sent (persisted so reload shows "sent").
  emailSent?: boolean
}

interface PdfAttachment {
  attachmentId: string
  name: string
  text: string
  pages: number
  truncated: boolean
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

// A reopenable handle for an artifact (app / draft) produced in a message, so
// it can be opened in the side panel any time — not just when first created.
function ArtifactCard({
  icon,
  title,
  subtitle,
  active,
  onOpen,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  active?: boolean
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className={`mt-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
        active ? "border-white/25 bg-white/[0.07]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{title}</span>
        <span className="block truncate text-xs text-white/45">{subtitle}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-white/60">{active ? "Open" : "Open ↗"}</span>
    </button>
  )
}

// The Simplicity monogram — the same drawn "S" as the splash, in a subtle glass
// tile, so the brand mark reads consistently everywhere.
function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.7)] ${className}`}
    >
      <svg viewBox="0 0 100 100" className="size-[56%] overflow-visible">
        <path
          d="M70,32 C70,21 56,17 45,21 C33,25 31,37 43,43 C55,49 70,51 69,63 C68,76 52,81 39,76 C32,74 29,69 28,63"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        />
      </svg>
    </span>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [micListening, setMicListening] = useState(false)
  const [loading, setLoading] = useState(false)
  // Holds the cinematic splash for its full reveal once per session.
  const [splashHold, setSplashHold] = useState(true)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID)
  const [reasoning, setReasoning] = useState<Reasoning>("medium")
  const [modelMenu, setModelMenu] = useState(false)
  const [panelVisual, setPanelVisual] = useState<Visual | null>(null)
  const [panelDraft, setPanelDraft] = useState<DraftData | null>(null)
  const [panelApp, setPanelApp] = useState<AppData | null>(null)
  // Index of the message whose sub-agents are shown (live) in the side panel.
  const [agentPanelIdx, setAgentPanelIdx] = useState<number | null>(null)
  const [auraTrigger, setAuraTrigger] = useState(0)
  const [greeting, setGreeting] = useState("")
  const [thinking, setThinking] = useState(false)
  // Ambient background status: gray by default, a red wash on error, a green
  // wash when a turn finishes cleanly — then it settles back to gray.
  const [bgStatus, setBgStatus] = useState<BgStatus>("idle")
  // Downtime experience shown on error: red shader → "take a break" notice →
  // Snake with a 5-min timer → green "return to work" → back to gray.
  const [downtime, setDowntime] = useState(false)
  const [showNotice, setShowNotice] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  const [returnMsg, setReturnMsg] = useState(false)
  const [errorNote, setErrorNote] = useState("")
  const [failedModel, setFailedModel] = useState<string | undefined>(undefined)
  const dtTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  // Track which assistant message indices have had their questions answered / plan decided.
  const [answeredIdx, setAnsweredIdx] = useState<Set<number>>(new Set())
  const [planDecisions, setPlanDecisions] = useState<Record<number, "approved" | "denied">>({})
  // Auth + chat history
  const [user, setUser] = useState<{ email: string; name: string | null } | null | undefined>(undefined)
  // The user's custom "rules" (system prompt) — forwarded with each chat request.
  const [userRules, setUserRules] = useState("")
  // Whether the user has connected Gmail — gates the email tool and the
  // Connect/Disconnect commands.
  const [gmailConnected, setGmailConnected] = useState(false)
  const [conversations, setConversations] = useState<ConvoLite[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  
  // PDF attachments queued for the next message — text is extracted server-side
  // (the chat models are text-only) and folded into the request, not shown raw.
  const [attachments, setAttachments] = useState<PdfAttachment[]>([])
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  // Focus mode — quiets the UI, dims/blurs the background, makes the AI concise
  // and on-task, and enables double-click dictionary lookups.
  const [focusMode, setFocusMode] = useState(false)
  // Focus level shapes how far it goes: Light (gentle), Deep (concise), Study (coach).
  const [focusLevel, setFocusLevel] = useState<"light" | "deep" | "study">("deep")
  const [ambientOn, setAmbientOn] = useState(false)
  // Long-term memory viewer (what the assistant remembers about the user).
  const [memoryOpen, setMemoryOpen] = useState(false)
  // Chats manager (search / pin / rename / delete conversations).
  const [chatsOpen, setChatsOpen] = useState(false)
  // Artifacts gallery (all apps/drafts across every chat).
  const [artifactsOpen, setArtifactsOpen] = useState(false)

  // Compute greeting on the client only (avoids SSR/hydration mismatch).
  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  // Returned from Google OAuth (?gmail=connected|denied|error|unconfigured).
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("gmail")
    if (!g) return
    const messages: Record<string, string> = {
      connected: "Gmail connected securely with Google ✓",
      denied: "Gmail connection was cancelled.",
      error: "Couldn't connect Gmail. Please try again.",
      unconfigured: "Google sign-in isn't set up on this server.",
    }
    if (messages[g]) toast(messages[g])
    if (g === "connected") setGmailConnected(true)
    window.history.replaceState({}, "", window.location.pathname) // don't re-toast on refresh
  }, [])

  // Auto-dismiss the splash once the user is loaded.
  useEffect(() => {
    if (user !== undefined && splashHold) {
      const t = setTimeout(() => setSplashHold(false), 1200)
      return () => clearTimeout(t)
    }
  }, [user, splashHold])

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
        setUserRules(typeof d.user.systemPrompt === "string" ? d.user.systemPrompt : "")
        setGmailConnected(d.user.gmailConnected === true)
        // Mirror the account's ambient preferences to localStorage so the
        // client-only NightMode / shader components can read them synchronously.
        mirrorSettingsToLocal(parseSettings(d.user.settings))
        // The welcome moment now plays on /menu right after sign-in, so chat
        // just loads straight in.
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
  // Whether the view is pinned to the bottom. Stays true while the user is near
  // the end; goes false the moment they scroll up to read — so streaming never
  // yanks them back down mid-read. This is the difference between calm and jittery.
  const atBottomRef = useRef(true)
  const [showJump, setShowJump] = useState(false)
  // Abort control for the streaming request (the Stop button).
  const abortRef = useRef<AbortController | null>(null)
  const stoppedRef = useRef(false)

  const model = getModel(modelId)

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    atBottomRef.current = atBottom
    setShowJump(!atBottom && el.scrollHeight - el.clientHeight > 240)
  }

  const jumpToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = true
    setShowJump(false)
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }

  const stop = () => {
    stoppedRef.current = true
    abortRef.current?.abort()
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !atBottomRef.current) return
    // Instant during streaming (avoids smooth-scroll jitter on every token);
    // a single gentle glide once the turn settles.
    el.scrollTo({ top: el.scrollHeight, behavior: loading ? "auto" : "smooth" })
  }, [messages, loading])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 180) + "px"
  }, [input])

  // ── Downtime experience orchestration ──────────────────────────────────────
  const clearDtTimers = () => {
    dtTimers.current.forEach(clearTimeout)
    dtTimers.current = []
  }
  const later = (fn: () => void, ms: number) => {
    dtTimers.current.push(setTimeout(fn, ms))
  }

  // On error: red shader + fade the chat + a notice, then reveal the break game.
  const startDowntime = (model?: string) => {
    if (downtime) return
    clearDtTimers()
    setFailedModel(model ?? modelId)
    setErrorNote(collapseMessage())
    setBgStatus("error")
    setDowntime(true)
    setShowNotice(false) // start hidden so the fade-IN actually plays (not a pop)
    setShowBoard(false)
    setReturnMsg(false)
    later(() => setShowNotice(true), 450) // slow fade-in once the overlay has mounted
    later(() => setShowNotice(false), 8500) // hold a good while, then fade out
    later(() => {
      setBgStatus("idle") // red fades back to gray once the text is gone…
      setShowBoard(true) // …and the status board fades in
    }, 10500)
  }

  // The status board detected everything is back: green acknowledgment, then
  // fade the chat back in so the user is returned to their work automatically.
  const handleRecover = () => {
    clearDtTimers()
    setShowBoard(false)
    setBgStatus("success")
    setReturnMsg(true)
    later(() => {
      setReturnMsg(false)
      setBgStatus("idle")
    }, 5000)
    later(() => setDowntime(false), 5800) // chat fades back in
  }

  // Leave the break (close button, or starting a new chat): restore the chat.
  const closeDowntime = () => {
    clearDtTimers()
    setShowBoard(false)
    setShowNotice(false)
    setReturnMsg(false)
    setBgStatus("idle")
    setDowntime(false)
  }

  const copy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    toast("Copied to clipboard", "success")
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const reset = () => {
    setMessages([])
    setInput("")
    setPanelVisual(null)
    setPanelDraft(null)
    setPanelApp(null)
    setAgentPanelIdx(null)
    setConversationId(null)
    setAttachments([])
    closeDowntime()
  }

  const MAX_ATTACHMENTS = 3

  const handlePdfSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = MAX_ATTACHMENTS - attachments.length
    if (room <= 0) {
      toast(`You can attach up to ${MAX_ATTACHMENTS} PDFs per message.`, "error")
      return
    }
    const picked = Array.from(files).slice(0, room)
    setUploadingPdf(true)
    for (const file of picked) {
      try {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/upload-pdf", { method: "POST", body: form })
        const data = await res.json()
        if (!res.ok) {
          toast(data.error ?? `Couldn't read ${file.name}.`, "error")
          continue
        }
        setAttachments((a) => [...a, data as PdfAttachment])
        if (data.truncated) toast(`${file.name} is long — only the first part was used.`, "success")
      } catch {
        toast(`Couldn't upload ${file.name}.`, "error")
      }
    }
    setUploadingPdf(false)
  }

  const removeAttachment = (name: string) => {
    setAttachments((a) => a.filter((f) => f.name !== name))
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
    setPanelApp(null)
    setAgentPanelIdx(null)
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) return
      const d = await res.json()
      setMessages(
        (d.messages ?? []).map((m: { role: "user" | "assistant"; content: string; artifacts?: string | null }) => {
          const msg: Message = { role: m.role, content: m.content }
          if (m.artifacts) {
            try {
              const a = JSON.parse(m.artifacts) as {
                app?: AppData
                draft?: DraftData
                attachments?: { name: string }[]
                email?: StagedEmail[]
                inbox?: InboxItem[]
                deleteEmails?: DeleteItem[]
                file?: { id: string; name: string; mime?: string; size?: number; spec?: PdfSpec }
                files?: { id: string; name: string; mime?: string; size?: number; spec?: PdfSpec }[]
              }
              if (a.app) msg.app = a.app
              if (a.draft) msg.draft = a.draft
              if (a.attachments) msg.attachments = a.attachments
              if (a.email) msg.email = a.email
              if (a.inbox) msg.inbox = a.inbox
              if (a.deleteEmails) msg.deleteEmails = a.deleteEmails
              // New rows persist `files`; older rows have a single `file`.
              if (a.files?.length) msg.files = a.files
              else if (a.file) msg.files = [a.file]
              if ((a as Record<string, unknown>).emailSent) msg.emailSent = true
            } catch {}
          }
          return msg
        })
      )
      setConversationId(id)
      // Mark all loaded assistant messages as "answered" / plan-decided so
      // questions and plan blocks render in their completed state on reload.
      const loaded = d.messages ?? []
      const answeredSet = new Set<number>()
      const decisions: Record<number, "approved" | "denied"> = {}
      loaded.forEach((_: unknown, i: number) => {
        answeredSet.add(i)
        decisions[i] = "approved"
      })
      setAnsweredIdx(answeredSet)
      setPlanDecisions(decisions)
    } catch {}
  }

  const deleteConvo = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" })
    } catch {}
    setConversations((c) => c.filter((x) => x.id !== id))
    if (conversationId === id) reset()
  }

  const renameConvo = async (id: string, title: string) => {
    setConversations((c) => c.map((x) => (x.id === id ? { ...x, title } : x)))
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
    } catch {}
  }

  const pinConvo = async (id: string, pinned: boolean) => {
    // Optimistically update + resort (pinned first, then most-recent).
    setConversations((c) =>
      [...c.map((x) => (x.id === id ? { ...x, pinned: pinned ? 1 : 0 } : x))].sort(
        (a, b) => (b.pinned ?? 0) - (a.pinned ?? 0) || b.updatedAt - a.updatedAt
      )
    )
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      })
    } catch {}
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    window.location.href = "/login"
  }

  // ── Gmail connection — secure Google OAuth (no passwords) ───────────────────
  // Sends the user to Google's consent screen; the /auth/google/callback route
  // stores the refresh token and returns to /chat?gmail=connected.
  const connectGmail = () => {
    toast("Redirecting to Google to connect Gmail…")
    window.location.href = "/api/gmail/oauth/start"
  }

  const testGmail = async () => {
    toast("Testing Gmail connection…")
    try {
      const res = await fetch("/api/email/test", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      toast(data.ok ? "Gmail connection works ✓" : data.error ?? "Gmail test failed.")
    } catch {
      toast("Network error testing Gmail.")
    }
  }

  const disconnectGmail = async () => {
    try {
      await fetch("/api/gmail", { method: "DELETE" })
    } catch {}
    setGmailConnected(false)
    toast("Gmail disconnected.")
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    atBottomRef.current = true // sending returns focus to the latest turn
    stoppedRef.current = false
    playSend()
    let ctrl = new AbortController()
    abortRef.current = ctrl
    const pendingAttachments = attachments
    const next: Message[] = [
      ...messages,
      {
        role: "user",
        content: trimmed,
        attachments: pendingAttachments.length
          ? pendingAttachments.map((a) => ({ name: a.name }))
          : undefined,
      },
    ]
    setMessages(next)
    setInput("")
    setAttachments([])
    setLoading(true)
    setThinking(false)
    setMessages((m) => [...m, { role: "assistant", content: "" }])

    // The model only ever sees plain text, so fold each PDF's extracted text
    // into the outgoing request as clearly-delimited context — the visible
    // bubble and persisted history stay just the user's typed message.
    const apiMessages: Message[] = pendingAttachments.length
      ? next.map((m, i) =>
          i === next.length - 1
            ? {
                ...m,
                content:
                  pendingAttachments
                    .map((a) => `[Attached PDF: ${a.name}${a.truncated ? " (truncated)" : ""}]\n${a.text}`)
                    .join("\n\n") + `\n\n${trimmed}`,
              }
            : m
        )
      : next

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
        body: JSON.stringify({
          role: "user",
          content: trimmed,
          artifacts: pendingAttachments.length
            ? { attachments: pendingAttachments.map((a) => ({ name: a.name })) }
            : undefined,
        }),
      }).catch(() => {})

    // The outgoing request body is identical across retries.
    const requestBody = JSON.stringify({
      messages: apiMessages,
      model: modelId,
      reasoning: model.supportsReasoning ? reasoning : "off",
      systemPrompt: userRules || undefined,
      gmailConnected,
      focus: focusMode ? focusLevel : false,
      // Files uploaded this turn — available for the AI to attach to an email.
      attachments: pendingAttachments.length
        ? pendingAttachments.map((a) => ({ id: a.attachmentId, name: a.name }))
        : undefined,
    })

    // Transient upstream hiccups (bad gateway, cold model, dropped connection)
    // are common with the free tier — retry the initial connection a few times
    // with backoff before giving up, so a single flaky attempt doesn't dead-end
    // the turn. We only ever retry BEFORE any tokens have streamed; once the
    // model starts answering we never re-send.
    const MAX_ATTEMPTS = 3
    const getResponse = async (): Promise<Response | null> => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (stoppedRef.current) return null
        try {
          // Fresh controller per attempt so an aborted retry doesn't poison the next.
          ctrl = new AbortController()
          abortRef.current = ctrl
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
            signal: ctrl.signal,
          })
          if (res.ok && res.body) return res
          // 4xx (except 429) won't fix themselves — don't waste retries on them.
          if (res.status >= 400 && res.status < 500 && res.status !== 429) return res
        } catch {
          if (stoppedRef.current) return null // user hit stop — not a failure
        }
        if (attempt < MAX_ATTEMPTS && !stoppedRef.current) {
          setThinking(true) // keep the "thinking" shimmer up while we retry
          await new Promise((r) => setTimeout(r, attempt * 1200)) // 1.2s, 2.4s
        }
      }
      return null
    }

    try {
      const res = await getResponse()

      if (!res || !res.ok || !res.body) {
        if (stoppedRef.current) return
        startDowntime()
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
      let email: StagedEmail[] | undefined
      let inbox: InboxItem[] | undefined
      let deleteEmails: DeleteItem[] | undefined
      let app: AppData | undefined
      let draft: DraftData | undefined
      const files: { id: string; name: string; mime?: string; size?: number; spec?: PdfSpec }[] = []

      // Replace the trailing assistant placeholder with the latest text/steps/agents.
      const flush = () => {
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = {
            role: "assistant",
            content: acc,
            steps: steps.length ? [...steps] : undefined,
            agents: agents.length ? agents.map((a) => ({ ...a, steps: [...a.steps] })) : undefined,
            email,
            inbox,
            deleteEmails,
            app,
            draft,
            files: files.length ? [...files] : undefined,
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
            files?: { name: string; content: string }[]
            entry?: string
            emails?: StagedEmail[]
            batchId?: string
            items?: InboxItem[] | DeleteItem[]
            control?: string
            value?: string
            level?: string
            connected?: boolean
            mime?: string
            size?: number
            spec?: PdfSpec
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
            // The agent opened/updated a draft — show it in the editable canvas
            // and keep it on the message so it can be reopened later.
            const d = { id: ev.id ?? "", title: ev.title ?? "Untitled draft", content: ev.content ?? "" }
            draft = d
            flush()
            setPanelVisual(null)
            setPanelApp(null)
            setAgentPanelIdx(null)
            setPanelDraft(d)
          } else if (ev.t === "email") {
            // The agent staged email(s) for approval — attach an inline card to
            // this assistant message. Nothing sends until the user clicks Send.
            if (Array.isArray(ev.emails) && ev.emails.length) {
              email = ev.emails
              flush()
            }
          } else if (ev.t === "inbox") {
            // read_emails returned a listing — show it as a read-only card.
            if (Array.isArray(ev.items)) {
              inbox = ev.items as InboxItem[]
              flush()
            }
          } else if (ev.t === "email_delete") {
            // delete_emails staged a Trash move — show the confirmation card.
            if (Array.isArray(ev.items) && ev.items.length) {
              deleteEmails = ev.items as DeleteItem[]
              flush()
            }
          } else if (ev.t === "gmail_connect") {
            connectGmail()
          } else if (ev.t === "gmail_disconnect") {
            disconnectGmail()
          } else if (ev.t === "gmail_status") {
            // Keep the client's connected flag in sync with what the tool saw.
            if (typeof ev.connected === "boolean") setGmailConnected(ev.connected)
          } else if (ev.t === "ui_control") {
            // The assistant changed a setting on the user's behalf — apply it.
            const on = ev.value === "on"
            if (ev.control === "night") {
              window.dispatchEvent(new CustomEvent("set-night", { detail: on }))
            } else if (ev.control === "focus") {
              setFocusMode(on)
              if (on && (ev.level === "light" || ev.level === "deep" || ev.level === "study")) setFocusLevel(ev.level)
            } else if (ev.control === "ambient_sound") {
              setAmbientOn(on)
            } else if (ev.control === "auto_night" || ev.control === "auto_morning") {
              // DB is updated server-side by the tool; mirror locally so the
              // ambient components react without a reload.
              mirrorSettingsToLocal({
                ...DEFAULT_SETTINGS,
                autoNight: ev.control === "auto_night" ? on : readLocalFlag(LS_AUTO_NIGHT),
                autoMorning: ev.control === "auto_morning" ? on : readLocalFlag(LS_AUTO_MORNING),
              })
            }
          } else if (ev.t === "file") {
            // A generated file (create_pdf/create_ppt). PUSH — a second file must
            // never replace the first (that was the "two PDFs, one shows" bug).
            if (ev.id && ev.name) files.push({ id: ev.id, name: ev.name, mime: ev.mime, size: ev.size, spec: ev.spec })
            flush()
          } else if (ev.t === "code") {
            // The coding agent built/edited an app — open it in the code canvas
            // and keep it on the message so it can be reopened later.
            const a = {
              id: ev.id ?? "",
              title: ev.title ?? "Untitled app",
              files: Array.isArray(ev.files) ? ev.files : [],
              entry: ev.entry ?? "",
            }
            app = a
            flush()
            setPanelVisual(null)
            setPanelDraft(null)
            setAgentPanelIdx(null)
            setPanelApp(a)
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
            startDowntime()
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

      // The turn finished cleanly — one low, warm settle.
      if (!stoppedRef.current && acc.trim()) playDone()

      // Persist the assistant's final answer + its reopenable artifacts (apps,
      // drafts, emails, files), then refresh the sidebar order.
      if (convoId && acc.trim()) {
        const artifacts: Record<string, unknown> = {}
        if (app) artifacts.app = app
        if (draft) artifacts.draft = draft
        if (email) artifacts.email = email
        if (inbox) artifacts.inbox = inbox
        if (deleteEmails) artifacts.deleteEmails = deleteEmails
        if (files.length) artifacts.files = files
        fetch(`/api/conversations/${convoId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: acc,
            ...(Object.keys(artifacts).length ? { artifacts } : {}),
          }),
        })
          .then(() => refreshConversations())
          .catch(() => {})
      }
    } catch {
      // A user-initiated stop is not an error — keep whatever streamed so far.
      if (!stoppedRef.current) {
        startDowntime()
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: "assistant", content: collapseMessage() }
          return copy
        })
      }
    } finally {
      abortRef.current = null
      setLoading(false)
      setThinking(false)
    }
  }

  // Mark a message's email as sent and persist the flag.
  const markEmailSent = (idx: number) => {
    setMessages((m) => {
      const copy = [...m]
      copy[idx] = { ...copy[idx], emailSent: true }
      return copy
    })
    if (conversationId) {
      const msg = messages[idx]
      if (msg?.email) {
        const artifacts: Record<string, unknown> = {}
        if (msg.app) artifacts.app = msg.app
        if (msg.draft) artifacts.draft = msg.draft
        if (msg.email) artifacts.email = msg.email
        if (msg.files?.length) artifacts.files = msg.files
        artifacts.emailSent = true
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index: idx, artifacts }),
        }).catch(() => {})
      }
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
      id: "p-app",
      group: "Start",
      label: "Build an app",
      icon: Code2,
      keywords: "code build website ui app frontend react",
      run: () => prefill("Build an app that "),
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
    { id: "night", group: "Actions", label: "Toggle Night mode", icon: Moon, keywords: "dark warm dim evening night", run: () => window.dispatchEvent(new Event("toggle-night")) },
    { id: "focus", group: "Actions", label: focusMode ? "Exit Focus mode" : "Enter Focus mode", icon: Focus, keywords: "focus concentrate deep study distraction dim dictionary", run: () => setFocusMode((v) => !v) },
    { id: "memory", group: "Actions", label: "View memory", icon: Brain, keywords: "memory remember personalization facts what you know forget privacy", run: () => setMemoryOpen(true) },
    { id: "chats", group: "Actions", label: "Manage chats", icon: MessageSquare, keywords: "search rename pin delete conversations history organize", run: () => setChatsOpen(true) },
    { id: "go-settings", group: "Go to", label: "Settings", icon: Settings, keywords: "preferences account gmail drive system prompt dimming animation", run: () => (window.location.href = "/settings") },
    { id: "go-home", group: "Go to", label: "Home", icon: Home, run: () => (window.location.href = "/") },
    { id: "go-dev", group: "Go to", label: "Developers", icon: Code2, run: () => (window.location.href = "/developers") },
    { id: "go-res", group: "Go to", label: "Resources", icon: BookOpen, run: () => (window.location.href = "/resources") },
    ...(gmailConnected
      ? [
          { id: "gmail-test", group: "Account", label: "Test Gmail connection", icon: Mail, keywords: "email smtp verify", run: testGmail } as Command,
          { id: "gmail-disconnect", group: "Account", label: "Disconnect Gmail", icon: Mail, keywords: "email smtp remove", run: disconnectGmail } as Command,
        ]
      : [{ id: "gmail-connect", group: "Account", label: "Connect Gmail with Google", icon: Mail, keywords: "email gmail google oauth sign in connect send", run: connectGmail } as Command]),
    ...(conversationId
      ? [{ id: "del", group: "Account", label: "Delete this chat", icon: Trash2, run: () => deleteConvo(conversationId) } as Command]
      : []),
    { id: "logout", group: "Account", label: "Log out", icon: LogOut, keywords: "sign out", run: logout },
  ]

  const empty = messages.length === 0

  const splash = splashHold ? <Splash /> : null

  // While auth resolves, the splash covers a plain ground; the chat swaps in
  // behind it and the splash dissolves onto the live page.
  if (user === undefined) {
    return (
      <>
        {splash}
        <div className="h-dvh bg-background" />
      </>
    )
  }

  // The world recedes while there's something to read: a panel open, a
  // sub-agent view, or an answer streaming in.
  const calmBg =
    !!panelApp || !!panelDraft || !!panelVisual || agentPanelIdx !== null || (loading && !downtime)


  return (
    <>
      {splash}
      <div className="relative flex h-dvh">
      {/* Same animated shader background as the landing page — tinted by app status */}
      <ShaderBackground fixed status={bgStatus} calm={calmBg} focus={focusMode} />
      <LiquidGlassFilters />

      {/* Dims the screen after 15s of no activity (sooner/deeper in focus mode) */}
      <InactivityDim seconds={15} focus={focusMode} />
      {/* Focus mode: level bar, ambient soundscape, and double-click dictionary */}
      {focusMode && (
        <FocusBar
          level={focusLevel}
          onLevel={setFocusLevel}
          ambientOn={ambientOn}
          onAmbient={() => setAmbientOn((v) => !v)}
          onExit={() => setFocusMode(false)}
        />
      )}
      <AmbientSound on={focusMode && ambientOn} />
      {focusMode && <DictionaryLookup />}
      {/* Long-term memory viewer */}
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      {/* Artifacts gallery — every app/draft the user has made, reopenable */}
      <ArtifactsPanel
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        onOpenApp={(a) => {
          setPanelDraft(null)
          setPanelVisual(null)
          setAgentPanelIdx(null)
          setPanelApp(a)
        }}
        onOpenDraft={(d) => {
          setPanelApp(null)
          setPanelVisual(null)
          setAgentPanelIdx(null)
          setPanelDraft(d)
        }}
      />
      {/* Chats manager — search / pin / rename / delete */}
      <ChatsPanel
        open={chatsOpen}
        conversations={conversations}
        activeId={conversationId}
        onClose={() => setChatsOpen(false)}
        onSelect={(id) => {
          setChatsOpen(false)
          loadConversation(id)
        }}
        onRename={renameConvo}
        onPin={pinConvo}
        onDelete={deleteConvo}
      />

      {/* ⌘K command palette */}
      <CommandPalette commands={commands} />

      {/* Apple-Intelligence-style activation flash when "high" is selected */}
      <ReasoningAura trigger={auraTrigger} />

      {/* ── Chat column ── */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Everything in the chat column fades out during the downtime experience */}
        <div
          className={`flex min-h-0 flex-1 flex-col transition-opacity duration-[1500ms] ${
            downtime ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
        {/* Minimal floating top: just the brand + new chat. In focus mode it
            recedes (quieter chrome) and gently reveals on hover. */}
        <div
          className={`group/top pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 transition-opacity duration-500 ${
            focusMode ? "opacity-25 hover:opacity-100" : "opacity-100"
          }`}
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <a
              href="/"
              className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white/90 transition-colors hover:text-white"
            >
              <span className="size-1.5 rounded-full bg-white/80" />
              Simplicity
            </a>
            <a
              href="/menu"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LayoutGrid className="size-3.5" />
              Menu
            </a>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {/* Model picker (opens downward) */}
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
                  <div className="liquid-glass liquid-glass-soft absolute top-full right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl p-1 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-out sm:w-72 max-h-[70vh] max-w-[calc(100vw-2rem)]">
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
            <Tooltip label="Artifacts" side="bottom">
              <button
                onClick={() => setArtifactsOpen(true)}
                aria-label="View all artifacts"
                className="inline-flex size-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LayoutGrid className="size-4" />
              </button>
            </Tooltip>
            <Tooltip label="Command palette" side="bottom">
              <button
                onClick={() => window.dispatchEvent(new Event("open-cmdk"))}
                aria-label="Open command palette"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <CommandIcon className="size-3.5" />
                <span className="font-mono">K</span>
              </button>
            </Tooltip>
            {!empty && (
              <Tooltip label="New chat" side="bottom">
                <button
                  onClick={reset}
                  aria-label="New chat"
                  className="inline-flex size-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Plus className="size-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Messages (only once a conversation has started) */}
        {!empty && (
          <div ref={scrollRef} onScroll={onScroll} className="chat-start flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-20">
              <div className="space-y-8">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "msg-in-user" : "msg-in-ai"}>
                    {m.role === "user" ? (
                      <div className="flex flex-col items-end gap-1.5">
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {m.attachments.map((a) => (
                              <span
                                key={a.name}
                                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs text-white/60"
                              >
                                <FileText className="size-3.5 text-white/40" />
                                <span className="max-w-[160px] truncate">{a.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
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
                                setPanelApp(null)
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
                                  setPanelApp(null)
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
                            // One calm, breathing indicator — same motion language everywhere.
                            <div className="flex items-center gap-2 pt-1">
                              <span className="size-2 animate-pulse rounded-full bg-white/55" />
                              <span className="animate-pulse text-sm text-white/55">Thinking…</span>
                            </div>
                          ) : (m.steps && m.steps.length > 0) ||
                            (m.agents && m.agents.length > 0) ||
                            (m.email && m.email.length > 0) ||
                            (m.inbox && m.inbox.length > 0) ||
                            (m.deleteEmails && m.deleteEmails.length > 0) ||
                            m.app ||
                            m.draft ||
                            (m.files && m.files.length > 0) ? null : (
                            <div className="flex items-center pt-1">
                              <span className="size-2 animate-pulse rounded-full bg-white/55" />
                            </div>
                          )}
                          {m.files?.map((f) =>
                            f.spec ? (
                              <PdfBlock
                                key={f.id}
                                spec={f.spec}
                                downloadUrl={`/api/uploads/${f.id}?download`}
                                downloadName={f.name}
                              />
                            ) : (
                              <a
                                key={f.id}
                                href={`/api/uploads/${f.id}?download`}
                                className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/25 hover:bg-white/[0.07]"
                              >
                                <span className="flex size-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05]">
                                  <FileText className="size-4 text-white/70" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[14px] font-medium text-white">{f.name}</span>
                                  <span className="block text-[11px] text-white/45">
                                    {f.size ? `${Math.round(f.size / 1024)} KB · ` : ""}Download
                                  </span>
                                </span>
                              </a>
                            )
                          )}
                          {m.email && m.email.length > 0 && (
                            <EmailApprovalCard
                              emails={m.email}
                              sent={m.emailSent}
                              onSent={() => markEmailSent(i)}
                            />
                          )}
                          {m.inbox && m.inbox.length > 0 && <InboxCard items={m.inbox} />}
                          {m.deleteEmails && m.deleteEmails.length > 0 && <DeleteEmailCard items={m.deleteEmails} />}
                          {m.app && (
                            <ArtifactCard
                              icon={<Code2 className="size-4 text-white/80" />}
                              title={m.app.title}
                              subtitle={`${m.app.files.length} file${m.app.files.length === 1 ? "" : "s"} · live app`}
                              active={panelApp?.id === m.app.id}
                              onOpen={() => {
                                setPanelVisual(null)
                                setPanelDraft(null)
                                setAgentPanelIdx(null)
                                setPanelApp(m.app!)
                              }}
                            />
                          )}
                          {m.draft && (
                            <ArtifactCard
                              icon={<FileText className="size-4 text-white/80" />}
                              title={m.draft.title}
                              subtitle="document"
                              active={panelDraft?.id === m.draft.id}
                              onOpen={() => {
                                setPanelVisual(null)
                                setPanelApp(null)
                                setAgentPanelIdx(null)
                                setPanelDraft(m.draft!)
                              }}
                            />
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

        {/* Scroll-to-bottom pill — appears when you've scrolled up mid-conversation */}
        {!empty && showJump && (
          <button
            onClick={jumpToBottom}
            aria-label="Scroll to latest"
            className="liquid-glass absolute bottom-32 left-1/2 z-20 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full text-white/80 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-90 duration-200 hover:text-white"
          >
            <ArrowDown className="size-4" strokeWidth={2.25} />
          </button>
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
            key={empty ? "hero" : "docked"} // remount on first send so the glass drop-in replays as the composer re-docks
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className={empty ? "w-full max-w-2xl" : "mx-auto w-full max-w-3xl"}
          >
            <div
              className={`glass-in liquid-glass flex w-full flex-col gap-2 rounded-[28px] px-4 pb-2.5 pt-3 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out focus-within:border-white/25 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_24px_64px_-16px_rgba(0,0,0,0.75)] ${
                micListening ? "!border-red-400/40 !shadow-[0_0_0_1px_rgba(248,113,113,0.35),0_0_32px_-8px_rgba(248,113,113,0.5)]" : ""
              }`}
            >
              {/* attached PDFs / mic status */}
              {(attachments.length > 0 || uploadingPdf || micListening) && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  {micListening && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 animate-in fade-in zoom-in-95 duration-200">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-red-400" />
                      </span>
                      Listening…
                    </span>
                  )}
                  {attachments.map((a) => (
                    <span
                      key={a.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] py-1 pl-2.5 pr-1.5 text-xs text-white/75 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <FileText className="size-3.5 text-white/45" />
                      <span className="max-w-[160px] truncate">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.name)}
                        aria-label={`Remove ${a.name}`}
                        className="rounded-full p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {uploadingPdf && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs text-white/50">
                      <Loader2 className="size-3.5 animate-spin" />
                      Reading…
                    </span>
                  )}
                </div>
              )}
              {/* input row */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                    return
                  }
                  // Tactile typing feedback — skip modifier combos and
                  // navigation/control keys so only actual edits tick.
                  if (e.ctrlKey || e.metaKey || e.altKey) return
                  if (e.key === "Backspace" || e.key === "Delete") playBackspace()
                  else if (e.key.length === 1) playType()
                }}
                rows={1}
                autoFocus
                placeholder={micListening ? "Listening… speak now" : "Ask Simplicity anything…"}
                className="max-h-52 min-h-[28px] w-full resize-none bg-transparent px-1 py-1 text-base leading-relaxed text-white placeholder:text-white/40 transition-[height] duration-150 ease-out focus:outline-none"
              />

              {/* toolbar row: controls left, send right */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Attach PDF */}
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    hidden
                    onChange={(e) => {
                      handlePdfSelect(e.target.files)
                      e.target.value = "" // allow re-selecting the same file later
                    }}
                  />
                  <Tooltip label="Attach a PDF" side="top">
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={uploadingPdf || attachments.length >= MAX_ATTACHMENTS}
                      aria-label="Attach a PDF"
                      className="inline-flex size-8 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Paperclip className="size-4" />
                    </button>
                  </Tooltip>

                  {/* Focus mode */}
                  <Tooltip label={focusMode ? "Exit focus mode" : "Focus mode"} side="top">
                    <button
                      type="button"
                      onClick={() => setFocusMode((v) => !v)}
                      aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
                      aria-pressed={focusMode}
                      className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${
                        focusMode ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Focus className="size-4" />
                    </button>
                  </Tooltip>

                  {/* Mic — dictates straight into the composer */}
                  <MicButton baseText={input} onResult={setInput} onListeningChange={setMicListening} />

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

                {loading ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop generating"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105"
                  >
                    <Square className="size-4" fill="currentColor" strokeWidth={0} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 disabled:scale-100 disabled:opacity-30"
                  >
                    <ArrowUp className="size-5" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2.5 text-center text-xs text-white/40">Simplicity can make mistakes.</p>
          </form>
        </div>
        </div>
        {/* ── Downtime experience overlay (notice → break game → return message) ── */}
        {downtime && (
          <div className="absolute inset-0 z-30 flex items-center justify-center px-4">
            <div
              className={`pointer-events-none absolute px-6 text-center transition-opacity duration-[2000ms] ease-out ${
                showNotice ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Take a break for now, Simplicity is down.
              </p>
              <p className="mt-4 text-sm text-white/45">{errorNote}</p>
            </div>

            {showBoard && (
              <div className="animate-in fade-in duration-[1400ms]">
                <StatusBoard failedModel={failedModel} onClose={closeDowntime} onRecover={handleRecover} />
              </div>
            )}

            <div
              className={`pointer-events-none absolute top-[12%] px-6 text-center transition-opacity duration-[1600ms] ease-out ${
                returnMsg ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Return to your work.</p>
              <p className="mt-3 text-[15px] text-white/55">Thank you for your patience.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right side pane: agents / draft / visual ── */}
      {(() => {
        const agentMsg = agentPanelIdx !== null ? messages[agentPanelIdx] : null
        const showAgents = !!agentMsg?.agents?.length
        const open = showAgents || !!panelDraft || !!panelApp || !!panelVisual
        if (!open) return null
        const body = showAgents ? (
          <AgentPanel agents={agentMsg!.agents!} onClose={() => setAgentPanelIdx(null)} />
        ) : panelApp ? (
          <CodeCanvas app={panelApp} onClose={() => setPanelApp(null)} />
        ) : panelDraft ? (
          <DraftCanvas draft={panelDraft} onClose={() => setPanelDraft(null)} />
        ) : panelVisual ? (
          <VisualPanel visual={panelVisual} onClose={() => setPanelVisual(null)} />
        ) : null
        return (
          <>
            <div className="relative z-10 hidden w-[44%] max-w-[640px] shrink-0 p-3 md:block animate-in fade-in zoom-in-95 slide-in-from-right-2 duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
              <div className="liquid-glass liquid-glass-soft glass-float h-full overflow-hidden rounded-[var(--glass-radius)]">{body}</div>
            </div>
            <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xl md:hidden animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
              {body}
            </div>
          </>
        )
      })()}

      </div>
    </>
  )
}
