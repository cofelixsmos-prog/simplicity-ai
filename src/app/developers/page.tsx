import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"
import { Code2, Briefcase, Sparkles, Users, ArrowRight } from "lucide-react"

export const metadata = {
  title: "Developers — Simplicity",
  description:
    "Apply to join the Simplicity developer program. Build integrations, contribute to open-source, and shape what comes next.",
}

const perks = [
  {
    icon: Code2,
    title: "API access",
    desc: "Early access to the Simplicity API when it launches — build integrations before anyone else.",
  },
  {
    icon: Sparkles,
    title: "Shape the product",
    desc: "Direct channel to the team. Your feedback drives what we build next.",
  },
  {
    icon: Users,
    title: "Community",
    desc: "Join a small group of builders who care about making AI simple and useful.",
  },
  {
    icon: Briefcase,
    title: "Recognition",
    desc: "Top contributors get featured on the site and early access to every new feature.",
  },
]

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-40">
        {/* Hero */}
        <div className="max-w-2xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Developers
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-[56px]">
            Build with us.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Simplicity is opening up to developers. Apply for early access to
            our API, contribute to the platform, and help shape what comes next.
          </p>
          <div className="mt-9">
            <a
              href="https://forms.gle/placeholder"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)]"
            >
              Apply now
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        {/* What you get */}
        <div className="mt-24">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            What you get
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {perks.map((p) => (
              <div
                key={p.title}
                className="group bg-card p-7 transition-colors hover:bg-secondary/40"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground/80 transition-colors group-hover:text-foreground">
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-24">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Questions
          </h2>
          <div className="mt-8 divide-y divide-border border-t border-border">
            <div className="py-6">
              <h3 className="text-base font-medium text-foreground">
                When does the API launch?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We&apos;re rolling it out in waves. Approved developers get
                access first — apply now to secure your spot.
              </p>
            </div>
            <div className="py-6">
              <h3 className="text-base font-medium text-foreground">
                Is the developer program free?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Yes, completely free during early access.
              </p>
            </div>
            <div className="py-6">
              <h3 className="text-base font-medium text-foreground">
                What can I build?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Anything — integrations, plugins, bots, workflows. If it uses
                Simplicity R1, we want to help you build it.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
