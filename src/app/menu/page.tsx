"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, FlaskConical, Box, ArrowRight, Lock } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { WelcomeOverlay } from "@/components/ui/welcome-overlay"

// The home menu shown right after login and reachable from anywhere (a "Menu"
// button lives in chat / studio). Right after a fresh login/register the
// welcome moment plays FIRST, then dissolves to reveal the menu.
export default function MenuPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string | null } | null | undefined>(undefined)
  const [welcome, setWelcome] = useState<"login" | "register" | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me")
        const d = await res.json()
        if (!d.user) {
          router.replace("/login")
          return
        }
        setUser({ name: d.user.name })
        // Play the welcome moment once, right after a fresh sign-in.
        try {
          if (sessionStorage.getItem("sx-just-logged-in")) {
            sessionStorage.removeItem("sx-just-logged-in")
            const kind = sessionStorage.getItem("sx-welcome-kind")
            sessionStorage.removeItem("sx-welcome-kind")
            setWelcome(kind === "register" ? "register" : "login")
          }
        } catch {}
      } catch {
        router.replace("/login")
      }
    })()
  }, [router])

  if (user === undefined) {
    return <main className="h-dvh bg-[#08080a]" />
  }

  const first = user?.name?.trim().split(/\s+/)[0]

  // Welcome plays over the shader first, then reveals the menu.
  if (welcome) {
    return (
      <main className="relative h-dvh overflow-hidden bg-[#08080a]">
        <ShaderBackground fixed calm />
        <LiquidGlassFilters />
        <WelcomeOverlay name={first ?? ""} kind={welcome} onDone={() => setWelcome(null)} />
      </main>
    )
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12 text-white">
      <ShaderBackground fixed calm />
      <LiquidGlassFilters />
      <div className="pointer-events-none fixed inset-0 bg-black/40" />

      <div className="relative z-10 w-full max-w-[860px]">
        <div className="anim-fade mb-10 text-center" style={{ ["--delay" as string]: "60ms" }}>
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            {first ? `Welcome back, ${first}` : "Welcome"}
          </span>
          <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-[42px]">
            What are you working on?
          </h1>
          <p className="mt-2.5 text-[15px] text-white/50">Choose a workspace — you can switch anytime from the menu.</p>
        </div>

        <div className="anim-fade grid gap-4 sm:grid-cols-2" style={{ ["--delay" as string]: "180ms" }}>
          <ModeCard
            icon={<Sparkles className="size-5" strokeWidth={1.6} />}
            title="General work"
            desc="Everyday reasoning, writing, code, documents, and deliverables — the full Simplicity assistant."
            accent="#e5e7eb"
            onClick={() => router.push("/chat")}
          />
          <ModeCard
            icon={<Box className="size-5" strokeWidth={1.6} />}
            title="Studio"
            desc="Design 2D and 3D objects on a live canvas — cars, buildings, floor plans, mechanisms."
            accent="#38BDF8"
            onClick={() => router.push("/studio")}
          />
          <ModeCard
            icon={<FlaskConical className="size-5" strokeWidth={1.6} />}
            title="Deep research"
            desc="Grounded, multi-source research with full citations."
            accent="#34D399"
            badge="Soon"
            disabled
          />
        </div>
      </div>
    </main>
  )
}

function ModeCard({
  icon,
  title,
  desc,
  accent,
  badge,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  accent: string
  badge?: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-start gap-4 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 text-left backdrop-blur-xl transition-all duration-300 ${
        disabled ? "cursor-default opacity-55" : "hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]"
      }`}
    >
      {/* accent glow on hover */}
      {!disabled && (
        <div
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `radial-gradient(120% 80% at 0% 0%, ${accent}22, transparent 60%)` }}
        />
      )}

      {badge && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70">
          {disabled && <Lock className="size-2.5" />}
          {badge}
        </span>
      )}

      <span
        className="relative flex size-11 items-center justify-center rounded-2xl border border-white/12"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>

      <div className="relative">
        <span className="flex items-center gap-2 text-[19px] font-semibold text-white">
          {title}
          {!disabled && <ArrowRight className="size-4 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/60" />}
        </span>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/50">{desc}</p>
      </div>
    </button>
  )
}
