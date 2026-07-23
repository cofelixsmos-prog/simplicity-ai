"use client"

import { useState } from "react"
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react"
import type { Question } from "@/lib/harness/types"

// Full-screen clarification: the whole view dims to the shader, and the
// executive's questions appear one at a time, calm and centered. Answers feed
// the research. Also reused for a single mid-run question.
export function ClarifyFlow({
  intro,
  questions,
  onDone,
  onSkip,
}: {
  intro: string
  questions: Question[]
  onDone: (answers: Record<string, string>) => void
  onSkip: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState("")

  const q = questions[idx]
  const isLast = idx === questions.length - 1

  const pick = (value: string) => {
    const next = { ...answers, [q.text]: value }
    setAnswers(next)
    setCustom("")
    if (isLast) onDone(next)
    else setIdx((i) => i + 1)
  }

  const submitCustom = () => {
    if (!custom.trim()) return
    pick(custom.trim())
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-6 backdrop-blur-md">
      <div className="relative z-10 w-full max-w-[560px]">
        {idx === 0 && (
          <p className="anim-fade mb-8 text-center text-[15px] leading-relaxed text-white/55">{intro}</p>
        )}

        <div key={q.id} className="anim-fade">
          <p className="mb-1 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/30">
            Question {idx + 1} of {questions.length}
          </p>
          <h2 className="mb-7 text-center text-[24px] font-semibold leading-tight tracking-tight text-white sm:text-[28px]">
            {q.text}
          </h2>

          <div className="flex flex-col gap-2.5">
            {q.options.map((opt) => (
              <button
                key={opt}
                onClick={() => pick(opt)}
                className="group flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-3.5 text-left text-[15px] text-white/85 backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/[0.07]"
              >
                {opt}
                <ArrowRight className="size-4 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/70" />
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCustom()}
              placeholder="Or type your own answer…"
              className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
            />
            <button
              onClick={submitCustom}
              disabled={!custom.trim()}
              className="flex size-7 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => (idx > 0 ? setIdx((i) => i - 1) : undefined)}
            disabled={idx === 0}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/40 transition-colors hover:text-white disabled:opacity-0"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
          <button onClick={onSkip} className="text-[13px] text-white/40 transition-colors hover:text-white">
            Skip questions →
          </button>
        </div>
      </div>
    </div>
  )
}

// Loading state while the executive drafts questions.
export function ClarifyLoading() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md">
      <div className="flex flex-col items-center gap-3 text-white/50">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-[14px]">The executive is scoping your objective…</p>
      </div>
    </div>
  )
}
