"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { PHASE_META, type Phase, type ReportSection } from "@/lib/harness/types"
import { Loader2, Download } from "lucide-react"

// The center piece: the research report as it's written, section by section.
// This is what the whole workspace exists to produce — so it's designed to read
// like a real document, not a debug panel.
export function ReportView({
  title,
  summary,
  sections,
  phase,
  running,
  sourceCount,
}: {
  title: string
  summary: string
  sections: ReportSection[]
  phase: Phase
  running: boolean
  sourceCount: number
}) {
  const download = () => {
    const md =
      `# ${title || "Research report"}\n\n` +
      (summary ? `> ${summary}\n\n` : "") +
      sections
        .sort((a, b) => a.order - b.order)
        .map((s) => `## ${s.heading}\n\n${s.body}`)
        .join("\n\n")
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(title || "report").replace(/[^\w]+/g, "_").slice(0, 60)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasContent = sections.length > 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white">{title}</h1>
            ) : (
              <div className="h-7 w-64 animate-pulse rounded-lg bg-white/[0.06]" />
            )}
            <p className="mt-2 flex items-center gap-2 text-[12px] text-white/40">
              {running ? (
                <>
                  <span className="size-1.5 rounded-full" style={{ background: PHASE_META[phase].color }} />
                  {PHASE_META[phase].label} · {sourceCount} sources
                </>
              ) : (
                <>Final report · {sourceCount} sources</>
              )}
            </p>
          </div>
          {hasContent && !running && (
            <button onClick={download} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:text-white">
              <Download className="size-3.5" /> .md
            </button>
          )}
        </div>

        {/* executive summary callout */}
        {summary && (
          <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-[13.5px] leading-relaxed text-white/70">{summary}</p>
          </div>
        )}

        {/* sections */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="mb-3 size-5 animate-spin text-white/40" />
            <p className="text-[13px] text-white/40">
              {phase === "plan" && "Designing the research plan…"}
              {phase === "research" && "Agents are searching the web…"}
              {phase === "analyze" && "Extracting findings from sources…"}
              {phase === "verify" && "Cross-checking claims…"}
              {(phase === "synthesize" || phase === "review") && "Writing the report…"}
            </p>
          </div>
        )}

        <div className="space-y-7">
          {sections
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <Section key={s.id} section={s} />
            ))}
        </div>

        {running && hasContent && (
          <p className="mt-8 flex items-center gap-2 text-[12px] text-white/35">
            <Loader2 className="size-3.5 animate-spin" /> More sections incoming…
          </p>
        )}
      </div>
    </div>
  )
}

function Section({ section }: { section: ReportSection }) {
  const isSources = section.heading.toLowerCase() === "sources"
  const components = useMemo(
    () => ({
      p: ({ children }: { children?: React.ReactNode }) => <p className="mb-3 text-[14.5px] leading-[1.75] text-white/75 last:mb-0">{children}</p>,
      a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-300/90 underline decoration-white/20 underline-offset-2 hover:decoration-white">
          {children}
        </a>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-[13px] text-white/60 marker:text-white/30">{children}</ol>,
      ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-2 list-disc space-y-1 pl-5 text-[14px] text-white/70 marker:text-white/30">{children}</ul>,
      li: ({ children }: { children?: React.ReactNode }) => <li className="leading-[1.6]">{children}</li>,
      strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-white/90">{children}</strong>,
    }),
    []
  )

  return (
    <section className="anim-fade">
      <h2 className={`mb-2.5 font-semibold tracking-tight text-white ${isSources ? "text-[15px] text-white/60" : "text-[17px]"}`}>
        {section.heading}
      </h2>
      <div className="prose-chat max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {section.body}
        </ReactMarkdown>
      </div>
    </section>
  )
}
