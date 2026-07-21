import type { Metadata } from "next"
import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"
import { OrgFlowchart } from "@/components/ui/org-flowchart"
import { GrowthGraph } from "@/components/ui/growth-graph"

export const metadata: Metadata = {
  title: "Companies — Simplicity",
  description:
    "The Simplicity family: parent company Simplicity, the adopted Bench Labs open-research lab, and our research partners including The ZSMC Co.",
  alternates: { canonical: "/companies" },
}

export default function CompaniesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-40">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Companies</p>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          One family, one mission.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Simplicity is the parent company. Around it sits a small, deliberate family — an adopted open-research lab
          and a set of research partners — all pointed at the same goal: intelligence without complexity.
        </p>

        {/* Org flowchart */}
        <section className="mt-16">
          <OrgFlowchart />
        </section>

        {/* Company write-ups */}
        <section className="mt-20 space-y-12">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Simplicity</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Simplicity builds a calm, capable AI assistant made in India — frontier reasoning refined down to what
              actually matters. It is the parent of everything on this page: it sets the direction, funds the work, and
              brings the research into a product people can actually use.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Bench Labs</h2>
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                Adopted
              </span>
            </div>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Building open source benchmarks, datasets, experiments, research, and AI. Everything here is designed to be
              explored, reproduced, improved, and shared by the community.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Simplicity adopted Bench Labs to give that open work a home and momentum. Under the Bench Labs umbrella sit
              three efforts: a community <strong className="text-white/85">Discord bot</strong>, <strong className="text-white/85">PixelModel</strong>,
              and a growing suite of open <strong className="text-white/85">benchmarks</strong>. Since joining the family,
              adoption has grown quickly — from a couple hundred users to roughly four thousand in about two months.
            </p>

            <div className="mt-8">
              <GrowthGraph
                accent="#38BDF8"
                caption="Bench Labs — user growth over the first two months (illustrative)"
                data={[
                  { label: "Wk 1", value: 200 },
                  { label: "Wk 3", value: 1200 },
                  { label: "Wk 6", value: 2600 },
                  { label: "Wk 8", value: 4000 },
                ]}
              />
            </div>

            <a
              href="/bench-labs"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white"
            >
              Explore Bench Labs →
            </a>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Partners</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Beyond the family, Simplicity collaborates with independent research organizations. Chief among them is{" "}
              <strong className="text-white/85">The ZSMC Co.</strong> — an independent initiative in electrochemical
              energy storage, materials science, computational systems, and applied AI.
            </p>
            <a
              href="/partners"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white"
            >
              See all partners →
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
