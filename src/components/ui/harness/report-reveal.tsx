"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, X } from "lucide-react"
import type { ReportSection } from "@/lib/harness/types"

// The finished report, revealed full-screen after the run. The show was the
// execution; this is the payoff — a clean, readable, cited document.
export function ReportReveal({
  title,
  summary,
  sections,
  sourceCount,
  onClose,
}: {
  title: string
  summary: string
  sections: ReportSection[]
  sourceCount: number
  onClose: () => void
}) {
  const ordered = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections])

  const download = () => {
    const md =
      `# ${title || "Research report"}\n\n` +
      (summary ? `> ${summary}\n\n` : "") +
      ordered.map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n")
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(title || "report").replace(/[^\w]+/g, "_").slice(0, 60)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const components = useMemo(
    () => ({
      p: ({ children }: { children?: React.ReactNode }) => <p className="mb-4 text-[15px] leading-[1.8] text-white/75 last:mb-0">{children}</p>,
      a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-300/90 underline decoration-white/20 underline-offset-2 hover:decoration-white">
          {children}
        </a>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-3 list-decimal space-y-1 pl-5 text-[13px] text-white/55 marker:text-white/30">{children}</ol>,
      ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-3 list-disc space-y-1 pl-5 text-[14.5px] text-white/70 marker:text-white/30">{children}</ul>,
      strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-white/90">{children}</strong>,
    }),
    []
  )

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 fixed inset-0 z-50 overflow-y-auto bg-[#08080a] duration-500">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#08080a]/80 px-5 py-3 backdrop-blur-xl">
        <span className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/40">Research report</span>
        <div className="flex items-center gap-2">
          <button onClick={download} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 hover:text-white">
            <Download className="size-3.5" /> .md
          </button>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">{title || "Research report"}</h1>
        <p className="mt-3 text-[12px] text-white/40">Compiled by Harness · {sourceCount} sources</p>

        {summary && (
          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[15px] leading-relaxed text-white/75">{summary}</p>
          </div>
        )}

        <div className="mt-10 space-y-9">
          {ordered.map((s) => (
            <section key={s.id}>
              <h2 className={`mb-3 font-semibold tracking-tight text-white ${s.heading.toLowerCase() === "sources" ? "text-[16px] text-white/55" : "text-[19px]"}`}>
                {s.heading}
              </h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {s.body}
              </ReactMarkdown>
            </section>
          ))}
        </div>
      </article>
    </div>
  )
}
