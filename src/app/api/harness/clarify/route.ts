import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { complete, extractJson } from "@/lib/harness/llm"
import type { Question } from "@/lib/harness/types"
import { randomUUID } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

const CLARIFY_SYSTEM = `You are the Executive of Harness, a deep-research system. Before researching, you ask the user only the questions that genuinely change the direction, scope, or output of the research. Never ask more than 4.
Return ONE JSON object only:
{
  "intro": "one warm sentence acknowledging the objective",
  "questions": [
    { "text": "the question", "options": ["2-4 suggested answers"] }
  ]
}
Ask about things like: focus/angle, depth, intended audience, desired output format, time range — but ONLY when they'd actually change the result. If the objective is already crystal clear, return an empty questions array.`

// Produces the clarifying questions for an objective (shown full-screen).
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  if (!user.harnessAccess) return jsonResponse({ error: "Harness is invite-only." }, { status: 403 }, req)

  let body: { objective?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }
  const objective = String(body.objective ?? "").trim()
  if (objective.length < 3) return jsonResponse({ error: "Provide an objective." }, { status: 400 }, req)

  const res = await complete(
    [
      { role: "system", content: CLARIFY_SYSTEM },
      { role: "user", content: `Objective: ${objective}` },
    ],
    { temperature: 0.4, maxTokens: 700, timeoutMs: 45_000 }
  )
  const parsed = extractJson<{ intro?: string; questions?: { text?: string; options?: string[] }[] }>(res.content)

  const questions: Question[] = (parsed?.questions ?? [])
    .slice(0, 4)
    .map((q) => ({
      id: randomUUID(),
      text: String(q.text ?? "").slice(0, 200),
      options: (q.options ?? []).map((o) => String(o).slice(0, 80)).slice(0, 4),
    }))
    .filter((q) => q.text)

  return jsonResponse(
    {
      intro: parsed?.intro ?? `Let's scope this out: "${objective}".`,
      questions,
    },
    { status: 200 },
    req
  )
}
