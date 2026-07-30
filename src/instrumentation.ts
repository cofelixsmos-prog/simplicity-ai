// Next.js runs this once when the server process starts. We use it to launch
// the automations background scheduler so agents run 24/7 on the server,
// independent of any browser session.
export async function register() {
  // Only on the Node.js server runtime (not edge, not the browser).
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { startScheduler } = await import("@/lib/automations/scheduler")
  startScheduler()
}
