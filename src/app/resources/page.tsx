import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"
import { BookOpen, Workflow, Box, Boxes, Brain, ArrowUpRight } from "lucide-react"

export const metadata = {
  title: "Resources — Simplicity",
  description:
    "Guides, references, and concepts for building with Simplicity — from quickstart to diagrams and reasoning.",
}

const guides = [
  {
    icon: BookOpen,
    title: "Quickstart",
    desc: "Go from zero to your first streamed response in a few minutes.",
    tag: "Guide",
    href: "/chat",
  },
  {
    icon: Workflow,
    title: "Flowcharts with Mermaid",
    desc: "Ask for processes and graphs — rendered as clean Mermaid diagrams.",
    tag: "Diagrams",
    href: "/chat",
  },
  {
    icon: Box,
    title: "2D SVG illustrations",
    desc: "Generate colored, labeled cutaways and schematics as vector art.",
    tag: "Diagrams",
    href: "/chat",
  },
  {
    icon: Boxes,
    title: "3D models",
    desc: "Spin up interactive Three.js scenes you can drag to rotate.",
    tag: "Diagrams",
    href: "/chat",
  },
  {
    icon: Brain,
    title: "Reasoning & effort",
    desc: "When to reach for R1 and how to tune low / medium / high effort.",
    tag: "Concept",
    href: "/developers",
  },
  {
    icon: BookOpen,
    title: "A1 vs R1",
    desc: "Choosing between fast everyday intelligence and frontier reasoning.",
    tag: "Concept",
    href: "/#models",
  },
]

const faqs = [
  {
    q: "Which model should I use?",
    a: "Start with A1 for fast, everyday tasks. Switch to R1 when a request needs multi-step reasoning, careful planning, or the best possible diagram quality.",
  },
  {
    q: "What can the AI draw?",
    a: "Three formats: Mermaid flowcharts/graphs, colored 2D SVG illustrations (cutaways, schematics), and interactive 3D models. Just ask in plain language.",
  },
  {
    q: "Is my API key safe?",
    a: "Yes. All model calls run server-side through the chat route, so the key is never shipped to the browser.",
  },
]

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-40">
        {/* Hero */}
        <div className="max-w-2xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Resources
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-[56px]">
            Learn Simplicity.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Guides and references to get the most out of A1 and R1 — from your
            first message to flowcharts, illustrations, and 3D models.
          </p>
        </div>

        {/* Guide cards */}
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <a
              key={g.title}
              href={g.href}
              className="group flex flex-col bg-card p-7 transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground/80 transition-colors group-hover:text-foreground">
                  <g.icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <span className="mt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {g.tag}
              </span>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {g.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {g.desc}
              </p>
            </a>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-24">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Frequently asked
          </h2>
          <div className="mt-8 divide-y divide-border border-t border-border">
            {faqs.map((f) => (
              <div key={f.q} className="py-6">
                <h3 className="text-base font-medium text-foreground">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
