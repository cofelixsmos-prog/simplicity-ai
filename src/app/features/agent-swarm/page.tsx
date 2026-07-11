import { MarketingPage } from "@/components/ui/marketing-page"

export const metadata = {
  title: "Agent Swarm — Parallel AI Agents for Big Tasks",
  description:
    "Simplicity's agent swarm delegates research, writing, design, and coding to multiple AI sub-agents working in parallel, with live progress you can watch and inspect.",
  alternates: { canonical: "/features/agent-swarm" },
}

const FAQ = [
  {
    q: "What is the Simplicity agent swarm?",
    a: "The agent swarm is Simplicity's way of handling large or multi-part requests. Instead of one model doing everything sequentially, Simplicity spawns up to three focused sub-agents — research, writer, coder, or general — that each take a piece of the task and work in parallel.",
  },
  {
    q: "Can I see what each agent is doing?",
    a: "Yes. Each agent appears as a node radiating out from a central hub, with a live status dot. Hover or click any node to see its current task, the tools it's using, and its progress — or open the full control room to watch every step across all agents at once.",
  },
  {
    q: "What kinds of tasks use the agent swarm?",
    a: "Anything that naturally splits into parallel workstreams: a research report that also needs a chart and a summary email, or a multi-part project like \"research this topic, write it up, and build a simple demo page.\" Simplicity decides on its own whether a request needs one agent or a swarm.",
  },
  {
    q: "Is the agent swarm slower or faster than a single AI response?",
    a: "Faster for multi-part work, because the sub-agents run concurrently rather than one after another. A single simple question still gets a direct, immediate answer — the swarm only kicks in when a task actually benefits from being split up.",
  },
]

export default function AgentSwarmPage() {
  return (
    <MarketingPage
      eyebrow="Features · Agent swarm"
      title="One request. Several agents working at once."
      intro="Some tasks aren't one question — they're several. Research a topic, write it up, chart the data, and draft an email about it. Simplicity's agent swarm splits work like that across multiple sub-agents running in parallel instead of making you wait through it one step at a time."
      faq={FAQ}
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">Four kinds of specialist agents</h2>
        <p className="mt-3">
          When a request is big enough to benefit from delegation, Simplicity spawns a team of up to
          three sub-agents, each assigned a kind — <strong className="text-foreground">research</strong> for
          web-grounded fact-finding, <strong className="text-foreground">writer</strong> for drafting documents,{" "}
          <strong className="text-foreground">coder</strong> for building live app previews, or{" "}
          <strong className="text-foreground">general</strong> for anything else. Each agent gets a clear,
          self-contained task rather than a vague slice of the whole request.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Watch it happen, not just wait for it</h2>
        <p className="mt-3">
          The swarm renders as a hub with each agent as a node radiating outward — the same visual
          language whether you're glancing at it in passing or want to dig into exactly what a
          research agent found. Hovering a node pops open its live steps and result summary right
          inline, without leaving the conversation.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Sub-agents can't send email or spawn more agents</h2>
        <p className="mt-3">
          Sub-agents are deliberately limited in scope — they can research, write, and build, but
          they can't send emails or spawn further sub-agents themselves. That keeps the blast radius
          of any single agent's output small: nothing leaves the conversation as an action (like a
          sent email) without a human reviewing and approving it first.
        </p>
      </div>
    </MarketingPage>
  )
}
