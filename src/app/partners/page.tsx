import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"
import { ArrowUpRight } from "lucide-react"

export const metadata = {
  title: "Partners — Simplicity",
  description:
    "Simplicity partners with leading research and technology organizations to advance frontier reasoning and emerging technologies.",
  alternates: { canonical: "/partners" },
}

const PARTNERS = [
  {
    name: "The ZSMC Co.",
    description:
      "Independent research initiative focused on electrochemical energy storage, materials science, computational systems, and applied artificial intelligence. ZSMC investigates scientific and engineering challenges through iterative experimentation, validation, and rigorous analysis.",
    url: "https://thezsmc.com",
    focus: "Research & Development",
  },
]

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-40">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Partners
        </p>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          Building together.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Simplicity partners with organizations that share our commitment to clarity, rigor, and
          real-world impact. Together, we advance frontier reasoning and emerging technologies.
        </p>

        <div className="mt-16 space-y-8">
          {PARTNERS.map((partner) => (
            <div
              key={partner.name}
              className="rounded-2xl border border-border bg-card p-8 transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-foreground">{partner.name}</h2>
                  <p className="mt-2 text-sm font-medium text-white/60">{partner.focus}</p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">{partner.description}</p>
                </div>
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Visit <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-2xl border border-border bg-card p-8">
          <h2 className="text-xl font-semibold text-foreground">Interested in partnering?</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If you're working on frontier research, emerging technologies, or breakthrough ideas and
            think Simplicity could help, we'd like to hear from you.
          </p>
          <a
            href="mailto:hello@simplicity-india.com"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)]"
          >
            Get in touch
          </a>
        </div>

        <div className="mt-16 flex flex-wrap gap-3 border-t border-border pt-10">
          <a
            href="/"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Back to home
          </a>
        </div>
      </main>

      <Footer />
    </div>
  )
}
