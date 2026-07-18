"use client"

import { useEffect, useRef } from "react"
import { Brain, Search, Mail, Zap, FileText, Users, Eye, Sparkles } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/*
  ── Capabilities section ────────────────────────────────────────────────
  Replaces the old scroll-driven "acts". This is a series of feature
  blocks — each one a full-width row with a big visual on one side and
  text on the other, alternating left/right. Between them, bold flat-color
  shapes float and parallax.
*/

interface Feature {
  tag: string
  title: string
  body: string
  icon: React.ElementType
  visual: "focus" | "build" | "swarm"
}

const FEATURES: Feature[] = [
  {
    tag: "Focus",
    title: "Distractions disappear.",
    body: "One tap and everything fades except the line you're reading. Light, Deep, and Study modes reshape how Simplicity talks to you — shorter, sharper, on-task.",
    icon: Eye,
    visual: "focus",
  },
  {
    tag: "Deliverables",
    title: "It ships real files.",
    body: "PDFs, slide decks, charts, spreadsheets — built inside the conversation and ready to download or email. Not lorem ipsum. Real, polished output.",
    icon: FileText,
    visual: "build",
  },
  {
    tag: "Agents",
    title: "One request, four workers.",
    body: "Simplicity splits complex tasks across parallel agents — research, write, design, build — then stitches the results into one clean deliverable.",
    icon: Users,
    visual: "swarm",
  },
]

// ── Visual panels ──────────────────────────────────────────────────────────

function FocusVisual() {
  return (
    <div className="relative w-full max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-[#111215] p-6">
        <div className="space-y-3">
          {[88, 100, 75, 100, 60].map((w, i) => (
            <div
              key={i}
              className="h-2 rounded-full"
              style={{
                width: `${w}%`,
                background: i === 2 ? "#fff" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
        {/* veil */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(180deg, rgba(17,18,21,0.95) 0%, rgba(17,18,21,0.95) 32%, transparent 44%, transparent 64%, rgba(17,18,21,0.95) 76%, rgba(17,18,21,0.95) 100%)" }} />
      </div>
      {/* mode bar */}
      <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#111215] p-0.5 pr-3">
        {["Light", "Deep", "Study"].map((m, i) => (
          <span key={m} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${i === 1 ? "bg-white text-black" : "text-white/40"}`}>{m}</span>
        ))}
        <span className="ml-1 font-mono text-[10px] tabular-nums text-white/40">19:48</span>
      </div>
    </div>
  )
}

function BuildVisual() {
  const bars = [35, 65, 28, 82, 50, 70, 42]
  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111215]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex gap-1">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-1 text-[10px] font-medium text-white/30">report.pdf</span>
      </div>
      <div className="p-5">
        <div className="space-y-2">
          <div className="h-3 w-3/5 rounded bg-white/25" />
          <div className="h-1.5 w-2/5 rounded bg-white/10" />
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="h-1.5 w-full rounded bg-white/[0.07]" />
          <div className="h-1.5 w-11/12 rounded bg-white/[0.07]" />
          <div className="h-1.5 w-4/5 rounded bg-white/[0.07]" />
        </div>
        <div className="mt-5 flex h-20 items-end gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-white/20" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SwarmVisual() {
  const nodes = [
    { label: "research", x: "-70px", y: "-50px", color: "#60a5fa" },
    { label: "design", x: "70px", y: "-40px", color: "#f472b6" },
    { label: "write", x: "-65px", y: "50px", color: "#34d399" },
    { label: "build", x: "65px", y: "55px", color: "#fbbf24" },
  ]
  return (
    <div className="relative flex h-56 w-full max-w-sm items-center justify-center">
      {/* lines */}
      <svg className="absolute inset-0 size-full" viewBox="-140 -100 280 200" aria-hidden>
        {nodes.map((n) => (
          <line key={n.label} x1="0" y1="0" x2={parseInt(n.x)} y2={parseInt(n.y)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        ))}
      </svg>
      {/* hub */}
      <div className="relative z-10 flex size-12 items-center justify-center rounded-xl border border-white/15 bg-[#111215]">
        <Zap className="size-5 text-white" />
      </div>
      {/* agents */}
      {nodes.map((n) => (
        <div key={n.label} className="absolute left-1/2 top-1/2 z-10" style={{ transform: `translate(calc(-50% + ${n.x}), calc(-50% + ${n.y}))` }}>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111215] py-1 pl-2 pr-2.5">
            <span className="size-1.5 rounded-full" style={{ background: n.color }} />
            <span className="text-[10px] font-medium text-white/60">{n.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const VISUALS = { focus: FocusVisual, build: BuildVisual, swarm: SwarmVisual }

// ── Floating shapes (flat solid colors, big, few) ──────────────────────────

function Shapes() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      // each shape parallaxes at its own speed
      el.querySelectorAll<HTMLElement>("[data-speed]").forEach((shape) => {
        const speed = parseFloat(shape.dataset.speed ?? "1")
        gsap.fromTo(shape,
          { y: 80 * speed },
          { y: -80 * speed, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1.5 } }
        )
      })

      // slow spins
      el.querySelectorAll<HTMLElement>("[data-spin]").forEach((shape) => {
        const dur = parseFloat(shape.dataset.spin ?? "20")
        gsap.to(shape, { rotation: 360, duration: dur, repeat: -1, ease: "none" })
      })
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* circle — top left */}
      <div data-speed="1.2" data-spin="25" className="absolute left-[7%] top-[8%]">
        <div className="size-20 rounded-full bg-[#60a5fa] opacity-[0.07] sm:size-28" />
      </div>

      {/* square — right, tilted */}
      <div data-speed="0.8" data-spin="35" className="absolute right-[9%] top-[22%]">
        <div className="size-14 rotate-45 rounded-md bg-[#f472b6] opacity-[0.08] sm:size-20" />
      </div>

      {/* ring — left center */}
      <div data-speed="1.5" data-spin="18" className="absolute left-[4%] top-[48%]">
        <div className="size-24 rounded-full border-[5px] border-[#34d399] opacity-[0.09] sm:size-32" />
      </div>

      {/* triangle — right center */}
      <div data-speed="1" className="absolute right-[6%] top-[55%]">
        <div className="size-0 border-x-[28px] border-b-[48px] border-x-transparent border-b-[#fbbf24] opacity-[0.07] sm:border-x-[36px] sm:border-b-[62px]" />
      </div>

      {/* dot — bottom left */}
      <div data-speed="0.6" className="absolute bottom-[18%] left-[12%]">
        <div className="size-5 rounded-full bg-[#a78bfa] opacity-[0.12] sm:size-7" />
      </div>

      {/* cross — bottom right */}
      <div data-speed="1.3" data-spin="30" className="absolute bottom-[12%] right-[10%]">
        <div className="relative size-16 opacity-[0.07] sm:size-22">
          <div className="absolute left-1/2 top-0 h-full w-3 -translate-x-1/2 rounded-full bg-[#fb923c]" />
          <div className="absolute left-0 top-1/2 h-3 w-full -translate-y-1/2 rounded-full bg-[#fb923c]" />
        </div>
      </div>
    </div>
  )
}

// ── Feature row ────────────────────────────────────────────────────────────

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const Visual = VISUALS[feature.visual]
  const flipped = index % 2 !== 0

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      // text side
      gsap.from(row.querySelectorAll(".feat-text > *"), {
        y: 40, autoAlpha: 0, stagger: 0.08, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: row, start: "top 78%", once: true },
      })

      // visual side
      gsap.from(row.querySelector(".feat-vis"), {
        y: 50, autoAlpha: 0, scale: 0.95, duration: 0.8, delay: 0.15, ease: "power3.out",
        scrollTrigger: { trigger: row, start: "top 78%", once: true },
      })
    }, row)

    return () => ctx.revert()
  }, [])

  const Icon = feature.icon

  return (
    <div
      ref={rowRef}
      className={`flex flex-col items-center gap-10 sm:gap-16 lg:gap-20 ${flipped ? "lg:flex-row-reverse" : "lg:flex-row"}`}
    >
      {/* text */}
      <div className="feat-text flex-1 max-w-lg">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
          <Icon className="size-3.5 text-white/50" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{feature.tag}</span>
        </div>
        <h3 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{feature.title}</h3>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{feature.body}</p>
      </div>

      {/* visual */}
      <div className="feat-vis flex flex-1 items-center justify-center">
        <Visual />
      </div>
    </div>
  )
}

// ── Bottom trio ────────────────────────────────────────────────────────────

const TRIO = [
  { icon: Brain, title: "Remembers you", body: "Your goals, preferences, and projects carry across every conversation.", color: "#818cf8" },
  { icon: Search, title: "Grounded answers", body: "Live web search with real citations — not hallucinated guesswork.", color: "#34d399" },
  { icon: Mail, title: "Inbox, handled", body: "Read, triage, and send Gmail right from the chat.", color: "#f472b6" },
]

function TrioSection() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      gsap.from(".tri-card", {
        y: 50, autoAlpha: 0, stagger: 0.1, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 82%", once: true },
      })
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className="mt-28 grid gap-4 sm:grid-cols-3 sm:mt-36">
      {TRIO.map((t) => {
        const Icon = t.icon
        return (
          <div key={t.title} className="tri-card group rounded-2xl border border-white/[0.07] bg-[#0a0b0e] p-6 transition-colors duration-300 hover:border-white/[0.12]">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
              <Icon className="size-[18px]" style={{ color: t.color }} />
            </div>
            <h4 className="text-[15px] font-semibold text-foreground">{t.title}</h4>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Export ──────────────────────────────────────────────────────────────────

export function CinematicStory() {
  return (
    <section id="capabilities" className="relative z-10 w-full bg-background px-6 py-28 sm:py-40">
      <Shapes />

      <div className="relative mx-auto max-w-6xl">
        {/* section header */}
        <div className="mb-20 max-w-2xl sm:mb-28">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <Sparkles className="size-3.5 text-white/50" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Capabilities</span>
          </div>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            What it actually does.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Not another chatbot. Simplicity focuses, builds real deliverables, and runs parallel agents — all in one calm interface.
          </p>
        </div>

        {/* feature rows */}
        <div className="space-y-24 sm:space-y-36">
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.visual} feature={f} index={i} />
          ))}
        </div>

        <TrioSection />
      </div>
    </section>
  )
}
