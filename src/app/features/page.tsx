import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"
import { Focus, Network, Mail, FileText, ArrowUpRight } from "lucide-react"

export const metadata = {
  title: "Features — Simplicity AI Assistant",
  description:
    "Explore Simplicity's core features: Focus mode for deep work, a parallel agent swarm, secure Gmail integration, and instant PDF/PPT/Excel document generation.",
  alternates: { canonical: "/features" },
}

const FEATURES = [
  {
    icon: Focus,
    title: "Focus mode",
    href: "/features/focus-mode",
    desc: "Dim the noise, keep a timer running, and let Simplicity adapt its tone to Light, Deep, or Study sessions — built for people who get distracted easily.",
  },
  {
    icon: Network,
    title: "Agent swarm",
    href: "/features/agent-swarm",
    desc: "Delegate a big task to multiple sub-agents that research, write, design, and build in parallel — then watch each one work in real time.",
  },
  {
    icon: Mail,
    title: "Gmail integration",
    href: "/features/gmail-integration",
    desc: "Read, search, draft, and send email from inside the chat — with a secure Google sign-in and an approval step before anything is ever sent.",
  },
  {
    icon: FileText,
    title: "Document generation",
    href: "/features/document-generation",
    desc: "Ask for a PDF report, a PowerPoint deck, or an Excel spreadsheet — Simplicity designs it, previews it live, and hands you a real downloadable file.",
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-40">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Features
        </p>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-[56px]">
          Everything Simplicity can do.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Simplicity is an AI chat assistant built around one idea: intelligence without complexity.
          Instead of stacking on tabs, plugins, and settings, it focuses on four things that
          genuinely change how you work — a distraction-free focus mode, a swarm of parallel
          sub-agents for big tasks, secure Gmail access, and real downloadable documents generated
          on demand.
        </p>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {FEATURES.map((f) => (
            <a
              key={f.href}
              href={f.href}
              className="group flex flex-col justify-between bg-card p-8 transition-colors hover:bg-secondary/40"
            >
              <div>
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground/80 transition-colors group-hover:text-foreground">
                  <f.icon className="size-5" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-foreground">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-white/70 transition-colors group-hover:text-white">
                Learn more <ArrowUpRight className="size-3.5" />
              </span>
            </a>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-3 border-t border-border pt-10">
          <a
            href="/register"
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)]"
          >
            Get early access
          </a>
        </div>
      </main>

      <Footer />
    </div>
  )
}
