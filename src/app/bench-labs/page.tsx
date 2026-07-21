import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"
import { BenchHero } from "@/components/ui/bench-hero"
import { GrowthGraph } from "@/components/ui/growth-graph"

export const metadata: Metadata = {
  title: "Bench Labs — Simplicity",
  description:
    "Bench Labs — building open source benchmarks, datasets, experiments, research, and AI. Explored, reproduced, improved, and shared by the community.",
  alternates: { canonical: "/bench-labs" },
}

const PROJECTS = [
  { name: "Discord bot", desc: "A community bot that brings Bench Labs' tools and experiments into the conversation.", accent: "#5865F2" },
  { name: "PixelModel", desc: "An open model effort exploring efficient, reproducible generation.", accent: "#A78BFA" },
  { name: "Benchmarks", desc: "Open, reproducible benchmarks and datasets for evaluating models honestly.", accent: "#34D399" },
]

export default function BenchLabsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* dimmed night-meadow hero (1/3 viewport, parallax) */}
      <BenchHero
        title="Bench Labs"
        tagline="Building open source benchmarks, datasets, experiments, research, and AI."
      />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <p className="text-lg leading-relaxed text-muted-foreground">
          Everything here is designed to be explored, reproduced, improved, and shared by the community. Bench Labs works
          in the open — research, engineering, and community, all in one place.
        </p>

        <a
          href="https://huggingface.co/spaces/bench-labs"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
        >
          Visit on Hugging Face
          <ArrowUpRight className="size-3.5" />
        </a>

        {/* Growth */}
        <section className="mt-16">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">Growing in the open</h2>
          <p className="mb-8 leading-relaxed text-muted-foreground">
            Bench Labs started small — a first cohort of a couple hundred people. As the work landed and Simplicity
            adopted the lab, adoption compounded quickly: past a thousand, then into the thousands, reaching roughly four
            thousand in about two months.
          </p>
          <GrowthGraph
            accent="#38BDF8"
            caption="User growth over the first two months (illustrative)"
            data={[
              { label: "Wk 1", value: 200 },
              { label: "Wk 3", value: 1200 },
              { label: "Wk 6", value: 2600 },
              { label: "Wk 8", value: 4000 },
            ]}
          />
        </section>

        {/* Projects */}
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">What we build</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {PROJECTS.map((p) => (
              <div key={p.name} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <span className="mb-3 block h-1 w-8 rounded-full" style={{ background: p.accent }} />
                <h3 className="text-[15px] font-semibold text-white">{p.name}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="mt-16">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">About Bench Labs</h2>
          <p className="leading-relaxed text-muted-foreground">
            Bench Labs is part of the Simplicity family — an open-research lab focused on the things that make AI
            trustworthy: honest benchmarks, reproducible datasets, and experiments anyone can rerun. Simplicity adopted
            the lab to give that open work a home, resources, and reach, while keeping it community-first. Releases have
            included efforts like bench-AGI and LRD (Latent Reasoning Directions).
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            The philosophy is simple: research is only real when others can check it. So everything is built to be
            explored, reproduced, improved, and shared.
          </p>

          <a
            href="/companies"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white"
          >
            See the Simplicity family →
          </a>
        </section>
      </main>

      <Footer />
    </div>
  )
}
