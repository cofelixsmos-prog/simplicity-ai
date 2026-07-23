// In-memory queue of live "steer" messages the user sends while a run is
// streaming. The run route drains this each phase; the steer route appends to
// it. Keyed by a per-run id. Single-instance only (fine for this app) — if this
// ever scales out, back it with Redis using the same shape.

interface RunSteer {
  messages: string[]
  createdAt: number
}

const runs = new Map<string, RunSteer>()

// Opportunistic cleanup so abandoned runs don't leak.
function sweep() {
  const cutoff = Date.now() - 30 * 60_000
  for (const [id, r] of runs) if (r.createdAt < cutoff) runs.delete(id)
}

export function openRun(runId: string) {
  sweep()
  runs.set(runId, { messages: [], createdAt: Date.now() })
}

export function pushSteer(runId: string, message: string): boolean {
  const r = runs.get(runId)
  if (!r) return false
  r.messages.push(message.slice(0, 500))
  return true
}

// Drain and return any pending steers (the run consumes them).
export function drainSteers(runId: string): string[] {
  const r = runs.get(runId)
  if (!r || !r.messages.length) return []
  const out = r.messages.splice(0)
  return out
}

export function closeRun(runId: string) {
  runs.delete(runId)
}
