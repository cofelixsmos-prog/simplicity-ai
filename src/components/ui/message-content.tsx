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
import { ExcelBlock } from "@/components/ui/excel-block"
import { QuestionsBlock } from "@/components/ui/questions-block"
import { PlanBlock } from "@/components/ui/plan-block"
import { CodeBlock } from "@/components/ui/code-block"

export type Visual = {
  kind: "mermaid" | "svg" | "threejs" | "chart" | "ppt" | "pdf" | "excel"
  code: string
}

const EXPANDABLE = new Set(["mermaid", "svg", "threejs", "chart", "ppt", "pdf", "excel"])

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
    ) : visual.kind === "excel" ? (
      <ExcelBlock code={visual.code} streaming={streaming} />
    ) : (
      <ThreeDiagram code={visual.code} streaming={streaming} />
    )

  return (
    <div className="group/visual relative">
      {body}
      {!streaming && onExpand && (
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
                  className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[0.85em] font-mono text-foreground"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return <CodeBlock code={text} lang={lang} />
          },
          // pre is a passthrough — the code renderer owns block rendering, so we
          // avoid an extra default <pre> wrapping our framed blocks.
          pre: ({ children }) => <>{children}</>,
          p: ({ children }) => <p className="mb-4 leading-[1.7] last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-1.5 pl-5 marker:text-white/35">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-1.5 pl-5 marker:text-white/35">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-[1.65] pl-1">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-white/25 underline-offset-[3px] transition-colors hover:decoration-white"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          h1: ({ children }) => (
            <h1 className="mb-3 mt-6 text-[1.35em] font-semibold tracking-tight first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-5 text-[1.15em] font-semibold tracking-tight first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-[1.02em] font-semibold first:mt-0">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-white/20 pl-4 italic text-foreground/65">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-white/10" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full border-collapse text-[13.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.03]">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-white/10 px-3.5 py-2.5 text-left font-medium text-foreground/70">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/[0.06] px-3.5 py-2.5 align-top text-foreground/85">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className="streaming-caret text-foreground/50" />}
    </div>
  )
}
