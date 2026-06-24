"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ComponentPropsWithoutRef } from "react"
import { Maximize2 } from "lucide-react"
import { MermaidDiagram } from "@/components/ui/mermaid-diagram"
import { SvgDiagram } from "@/components/ui/svg-diagram"
import { ThreeDiagram } from "@/components/ui/three-diagram"
import { ChartBlock } from "@/components/ui/chart-block"
import { PptBlock } from "@/components/ui/ppt-block"
import { PdfBlock } from "@/components/ui/pdf-block"
import { QuestionsBlock } from "@/components/ui/questions-block"
import { PlanBlock } from "@/components/ui/plan-block"

export type Visual = {
  kind: "mermaid" | "svg" | "threejs" | "chart" | "ppt" | "pdf"
  code: string
}

const EXPANDABLE = new Set(["mermaid", "svg", "threejs", "chart", "ppt", "pdf"])

function VisualBlock({
  visual,
  streaming,
  onExpand,
}: {
  visual: Visual
  streaming: boolean
  onExpand?: (v: Visual) => void
}) {
  const body =
    visual.kind === "mermaid" ? (
      <MermaidDiagram chart={visual.code} streaming={streaming} />
    ) : visual.kind === "svg" ? (
      <SvgDiagram code={visual.code} streaming={streaming} />
    ) : visual.kind === "chart" ? (
      <ChartBlock code={visual.code} streaming={streaming} />
    ) : visual.kind === "ppt" ? (
      <PptBlock code={visual.code} streaming={streaming} />
    ) : visual.kind === "pdf" ? (
      <PdfBlock code={visual.code} streaming={streaming} />
    ) : (
      <ThreeDiagram code={visual.code} streaming={streaming} />
    )

  return (
    <div className="group/visual relative">
      {body}
      {!streaming && onExpand && (
        <button
          onClick={() => onExpand(visual)}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white/80 opacity-0 backdrop-blur transition-opacity hover:bg-black/70 group-hover/visual:opacity-100"
          title="Open in side panel"
        >
          <Maximize2 className="size-3.5" />
          Expand
        </button>
      )}
    </div>
  )
}

export function MessageContent({
  content,
  streaming = false,
  onExpand,
  onAnswerQuestions,
  onApprovePlan,
  onDenyPlan,
  questionsAnswered = false,
  planDecision = null,
}: {
  content: string
  streaming?: boolean
  onExpand?: (v: Visual) => void
  onAnswerQuestions?: (text: string) => void
  onApprovePlan?: () => void
  onDenyPlan?: () => void
  questionsAnswered?: boolean
  planDecision?: "approved" | "denied" | null
}) {
  const openFences = (content.match(/```/g) || []).length
  const lastBlockUnclosed = streaming && openFences % 2 === 1

  return (
    <div className="prose-chat max-w-none text-[15px] leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({
            className,
            children,
            ...props
          }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) {
            const match = /language-(\w+)/.exec(className || "")
            const lang = match?.[1]
            const text = String(children).replace(/\n$/, "")

            if (lang === "questions") {
              return (
                <QuestionsBlock
                  code={text}
                  streaming={lastBlockUnclosed}
                  answered={questionsAnswered}
                  onSubmit={onAnswerQuestions}
                />
              )
            }

            if (lang === "plan") {
              return (
                <PlanBlock
                  code={text}
                  streaming={lastBlockUnclosed}
                  decided={planDecision}
                  onApprove={onApprovePlan}
                  onDeny={onDenyPlan}
                />
              )
            }

            if (lang && EXPANDABLE.has(lang)) {
              return (
                <VisualBlock
                  visual={{ kind: lang as Visual["kind"], code: text }}
                  streaming={lastBlockUnclosed}
                  onExpand={onExpand}
                />
              )
            }

            if (!className && !text.includes("\n")) {
              return (
                <code
                  className="rounded bg-secondary px-1.5 py-0.5 text-[13px] font-mono text-foreground"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-card p-4">
                <code className="text-[13px] font-mono text-foreground/90" {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-xl font-semibold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-lg font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold">{children}</h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
