"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

// A framed code block for assistant answers: a quiet header with the language
// label + a copy button, and a clean monospace body. Monochrome to hold the
// design language — hierarchy comes from weight/opacity, not syntax colors.
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="group/code my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0d]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/40">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <><Check className="size-3 text-emerald-400/80" /> Copied</>
          ) : (
            <><Copy className="size-3" /> Copy</>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[13px] leading-relaxed">
        <code className="font-mono text-white/85">{code}</code>
      </pre>
    </div>
  )
}
