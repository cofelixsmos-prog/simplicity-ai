import { randomUUID } from "crypto"
import { jsonResponse, preflight } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { runExecutive } from "@/lib/harness/orchestrator"
import { openRun, closeRun, drainSteers } from "@/lib/harness/steer-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Streams the whole Harness execution as NDJSON (one HarnessEvent per line).
// Access is gated: only users with harness_access may run it.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  if (!user.harnessAccess) return jsonResponse({ error: "Harness is invite-only." }, { status: 403 }, req)

  let body: { objective?: string; clarifications?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }
  const objective = String(body.objective ?? "").trim()
  if (objective.length < 3) return jsonResponse({ error: "Provide an objective." }, { status: 400 }, req)

  const runId = randomUUID()
  openRun(runId)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"))
        } catch {
          /* controller closed */
        }
      }
      // Tell the client the run id so it can send live steer messages.
      emit({ t: "run", runId })
      try {
        await runExecutive(objective, body.clarifications ?? {}, emit, () => drainSteers(runId))
      } catch (e) {
        emit({ t: "error", message: e instanceof Error ? e.message : "Execution failed." })
      } finally {
        closeRun(runId)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
