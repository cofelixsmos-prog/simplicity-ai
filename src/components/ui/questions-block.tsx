"use client"

import { useState } from "react"
import { Send } from "lucide-react"

interface Q {
  id: string
  q: string
  options?: string[]
}
interface QuestionsSpec {
  intro?: string
  questions: Q[]
}

function parse(code: string): QuestionsSpec | null {
  try {
    const o = JSON.parse(code.trim())
    if (!o || !Array.isArray(o.questions)) return null
    return o as QuestionsSpec
  } catch {
    return null
  }
}

export function QuestionsBlock({
  code,
  streaming = false,
  answered = false,
  onSubmit,
}: {
  code: string
  streaming?: boolean
  answered?: boolean
  onSubmit?: (text: string) => void
}) {
  const spec = parse(code)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  if (streaming) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
        <span className="size-1.5 animate-pulse rounded-full bg-white/50" />
        Thinking of a few questions…
      </div>
    )
  }
  if (!spec) return null

  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }))

  const submit = () => {
    if (!onSubmit) return
    const lines = spec.questions.map((q) => `${q.q} → ${answers[q.id] ?? "(no preference)"}`)
    onSubmit(lines.join("\n"))
  }

  const allAnswered = spec.questions.every((q) => answers[q.id])

  return (
    <div className="my-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      {spec.intro && <p className="mb-4 text-[15px] text-white/85">{spec.intro}</p>}
      <div className="space-y-5">
        {spec.questions.map((q) => (
          <div key={q.id}>
            <p className="mb-2 text-sm font-medium text-white">{q.q}</p>
            {q.options && q.options.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={answered}
                    onClick={() => set(q.id, opt)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      answers[q.id] === opt
                        ? "border-white bg-white text-black"
                        : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              disabled={answered}
              value={answers[q.id] ?? ""}
              onChange={(e) => set(q.id, e.target.value)}
              placeholder="Or type your own…"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
          </div>
        ))}
      </div>
      {!answered && (
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-all hover:scale-[1.02] disabled:opacity-30"
        >
          <Send className="size-3.5" />
          Submit answers
        </button>
      )}
      {answered && (
        <p className="mt-4 text-xs text-white/40">Answers submitted.</p>
      )}
    </div>
  )
}
