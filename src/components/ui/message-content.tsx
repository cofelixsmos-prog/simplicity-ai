"use client"

import { memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { Maximize2 } from "lucide-react"
import { MermaidDiagram } from "@/components/ui/mermaid-diagram"
import { SvgDiagram } from "@/components/ui/svg-diagram"
import { ThreeDiagram } from "@/components/ui/three-diagram"
import { ChartBlock } from "@/components/ui/chart-block"
import { PptBlock } from "@/components/ui/ppt-block"
import { PdfBlock } from "@/components/ui/pdf-block"
import { ExcelBlock } from "@/components/ui/excel-block"
import { QuestionsBlock } from "@/components/ui/questions-block"
import { PlanBlock } from "@/components/ui/plan-block"
import { CodeBlock } from "@/components/ui/code-block"

export type Visual = {
  kind: "mermaid" | "svg" | "threejs" | "chart" | "ppt" | "pdf" | "excel"
  code: string
}

const VISUAL_LANGS = new Set(["mermaid", "svg", "threejs", "chart", "ppt", "pdf", "excel"])
// Heavy = anything that mounts an expensive/stateful component we must NOT let
// ReactMarkdown remount on every streaming chunk (WebGL canvases, question forms…).
const HEAVY_LANGS = new Set([...VISUAL_LANGS, "questions", "plan"])

// A message body is a sequence of prose spans and heavy blocks. Splitting them
// into ordered segments lets the prose re-render freely on each streaming chunk
// while the heavy blocks stay mounted in their original position.
type Segment =
  | { type: "prose"; text: string }
  | { type: "block"; lang: string; code: string }

const FENCE_RE = /```(\w+)[ \t]*\r?\n([\s\S]*?)```/g

function toSegments(text: string): Segment[] {
  const segs: Segment[] = []
  let last = 0
  let m: RegExpExecArray | null
  FENCE_RE.lastIndex = 0
  while ((m = FENCE_RE.exec(text)) !== null) {
    const lang = m[1]
    if (!HEAVY_LANGS.has(lang)) continue // ordinary code fences stay in markdown
    if (m.index > last) {
      const prose = text.slice(last, m.index).trim()
      if (prose) segs.push({ type: "prose", text: prose })
    }
    segs.push({ type: "block", lang, code: m[2].replace(/\n$/, "") })
    last = m.index + m[0].length
  }
  const tail = text.slice(last).trim()
  if (tail) segs.push({ type: "prose", text: tail })
  return segs
}

function VisualBlock({
  visual,
  onExpand,
}: {
  visual: Visual
  onExpand?: (v: Visual) => void
}) {
  const body =
    visual.kind === "mermaid" ? (
      <MermaidDiagram chart={visual.code} />
    ) : visual.kind === "svg" ? (
      <SvgDiagram code={visual.code} />
    ) : visual.kind === "chart" ? (
      <ChartBlock code={visual.code} />
    ) : visual.kind === "ppt" ? (
      <PptBlock code={visual.code} />
    ) : visual.kind === "pdf" ? (
      <PdfBlock code={visual.code} />
    ) : visual.kind === "excel" ? (
      <ExcelBlock code={visual.code} />
    ) : (
      <ThreeDiagram code={visual.code} />
    )

  return (
    <div className="group/visual relative">
      {body}
      {onExpand && (
        <button
          onClick={() => onExpand(visual)}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white/80 opacity-70 backdrop-blur transition-opacity hover:bg-black/70 hover:opacity-100"
          title="Open in side panel"
        >
          <Maximize2 className="size-3.5" />
          Open
        </button>
      )}
    </div>
  )
}

const MARKDOWN_COMPONENTS = {
  code({
    className,
    children,
    ...props
  }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) {
    const match = /language-(\w+)/.exec(className || "")
    const lang = match?.[1]
    const text = String(children).replace(/\n$/, "")

    if (!className && !text.includes("\n")) {
      return (
        <code
          className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[0.85em] font-mono text-foreground"
          {...props}
        >
          {children}
        </code>
      )
    }

    return <CodeBlock code={text} lang={lang} />
  },
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
  p: ({ children }: { children?: ReactNode }) => <p className="mb-4 leading-[1.7] last:mb-0">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-4 list-disc space-y-1.5 pl-5 marker:text-white/35">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-4 list-decimal space-y-1.5 pl-5 marker:text-white/35">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="leading-[1.65] pl-1">{children}</li>,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground underline decoration-white/25 underline-offset-[3px] transition-colors hover:decoration-white"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold text-white">{children}</strong>,
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-3 mt-6 text-[1.35em] font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2.5 mt-5 text-[1.15em] font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-4 text-[1.02em] font-semibold first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-4 border-l-2 border-white/20 pl-4 italic text-foreground/65">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-white/10" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => <thead className="bg-white/[0.03]">{children}</thead>,
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-white/10 px-3.5 py-2.5 text-left font-medium text-foreground/70">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-white/[0.06] px-3.5 py-2.5 align-top text-foreground/85">
      {children}
    </td>
  ),
}

function Prose({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {text}
    </ReactMarkdown>
  )
}

interface MessageContentProps {
  content: string
  streaming?: boolean
  onExpand?: (v: Visual) => void
  onAnswerQuestions?: (text: string) => void
  onApprovePlan?: () => void
  onDenyPlan?: () => void
  questionsAnswered?: boolean
  planDecision?: "approved" | "denied" | null
}

function MessageContentInner({
  content,
  streaming = false,
  onExpand,
  onAnswerQuestions,
  onApprovePlan,
  onDenyPlan,
  questionsAnswered = false,
  planDecision = null,
}: MessageContentProps) {
  // Models sometimes glue a fenced block onto the previous sentence; force every
  // triple-backtick fence onto its own line so it's recognized as a block.
  const normalized = content.replace(/([^\n`])(```)/g, "$1\n\n$2")

  const openFences = (normalized.match(/```/g) || []).length
  const fenceOpen = streaming && openFences % 2 === 1

  // An unclosed trailing fence is still streaming. If it's a HEAVY block we hold
  // it back (rendering half-written 3D code / partial question JSON would crash
  // or flicker) and show a placeholder matched to its kind. Ordinary code fences
  // just stream through as text.
  const { stable, pendingLang } = useMemo(() => {
    if (!fenceOpen) return { stable: normalized, pendingLang: null as string | null }
    const lastFence = normalized.lastIndexOf("```")
    if (lastFence < 0) return { stable: normalized, pendingLang: null }
    const lang = normalized.slice(lastFence + 3).match(/^(\w+)/)?.[1] ?? null
    if (lang && HEAVY_LANGS.has(lang)) {
      return { stable: normalized.slice(0, lastFence), pendingLang: lang }
    }
    return { stable: normalized, pendingLang: null }
  }, [normalized, fenceOpen])

  const segments = useMemo(() => toSegments(stable), [stable])

  return (
    <div className="prose-chat max-w-none text-[15px] leading-relaxed text-foreground/90">
      {segments.map((seg, i) => {
        if (seg.type === "prose") return <Prose key={`prose-${i}`} text={seg.text} />

        if (seg.lang === "questions") {
          return (
            <QuestionsBlock
              key={`q-${i}`}
              code={seg.code}
              answered={questionsAnswered}
              onSubmit={onAnswerQuestions}
            />
          )
        }
        if (seg.lang === "plan") {
          return (
            <PlanBlock
              key={`p-${i}`}
              code={seg.code}
              decided={planDecision}
              onApprove={onApprovePlan}
              onDeny={onDenyPlan}
            />
          )
        }
        return (
          <VisualBlock
            key={`v-${i}-${seg.lang}`}
            visual={{ kind: seg.lang as Visual["kind"], code: seg.code }}
            onExpand={onExpand}
          />
        )
      })}

      {/* A heavy block still streaming in — render its OWN component in
          streaming mode so each keeps its native placeholder (the glassmorphic
          "Thinking of a few questions…" pill, "Building 3D model…", etc.)
          rather than a generic gray box. */}
      {pendingLang === "questions" ? (
        <QuestionsBlock code="" streaming />
      ) : pendingLang === "plan" ? (
        <PlanBlock code="" streaming />
      ) : pendingLang === "mermaid" ? (
        <MermaidDiagram chart="" streaming />
      ) : pendingLang === "svg" ? (
        <SvgDiagram code="" streaming />
      ) : pendingLang === "threejs" ? (
        <ThreeDiagram code="" streaming />
      ) : pendingLang === "chart" ? (
        <ChartBlock code="" streaming />
      ) : pendingLang === "ppt" ? (
        <PptBlock code="" streaming />
      ) : pendingLang === "pdf" ? (
        <PdfBlock code="" streaming />
      ) : pendingLang === "excel" ? (
        <ExcelBlock code="" streaming />
      ) : null}
      {streaming && !pendingLang && <span className="streaming-caret text-foreground/50" />}
    </div>
  )
}

// Memoized: in a long chat, `setMessages` fires on every streaming token, which
// re-renders the whole message list. Only the streaming message's `content`
// actually changes — every finished message has identical display props, so it
// skips re-parsing its markdown entirely. The callback props are recreated each
// parent render but never change behavior, so we intentionally ignore their
// identity and compare only the props that affect output.
export const MessageContent = memo(MessageContentInner, (prev, next) => {
  return (
    prev.content === next.content &&
    prev.streaming === next.streaming &&
    prev.questionsAnswered === next.questionsAnswered &&
    prev.planDecision === next.planDecision
  )
})
