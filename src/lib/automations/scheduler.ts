// The background scheduler. Started once at server boot (see src/instrumentation.ts)
// and runs for the lifetime of the server process — so automations keep working
// whether or not any user has a browser open. (It cannot run when the SERVER
// itself is down; that's the physical limit of "24/7".)

import { listRunningAutomations } from "@/lib/db/repo"
import { runTick } from "./engine"

const POLL_INTERVAL_MS = 60_000 // scan for due automations every minute
const MIN_TICK_GAP_MS = 75_000 // don't re-tick a given automation faster than this

let started = false
let running = false

async function scan() {
  if (running) return // never let two scans overlap
  running = true
  try {
    const autos = await listRunningAutomations()
    const now = Date.now()
    for (const auto of autos) {
      // Space out each automation's own polling.
      if (auto.lastRunAt && now - auto.lastRunAt < MIN_TICK_GAP_MS) continue
      try {
        await runTick(auto)
      } catch (e) {
        console.error(`[automations] tick failed for ${auto.id}:`, e)
      }
    }
  } catch (e) {
    console.error("[automations] scan failed:", e)
  } finally {
    running = false
  }
}

export function startScheduler() {
  if (started) return
  started = true
  console.log("[automations] scheduler started")
  // Kick off shortly after boot, then on a fixed interval.
  setTimeout(() => void scan(), 8_000)
  setInterval(() => void scan(), POLL_INTERVAL_MS)
}
