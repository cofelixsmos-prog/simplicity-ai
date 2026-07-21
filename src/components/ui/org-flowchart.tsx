"use client"

// Simplicity org / structure flowchart. Simplicity is the parent; below it sit
// Bench Labs (with its sub-projects) and a Partners branch (ZSMC). Rendered as
// styled DOM boxes + connector lines so it stays crisp and on-brand.

function Node({
  title,
  subtitle,
  href,
  accent,
  size = "md",
}: {
  title: string
  subtitle?: string
  href?: string
  accent?: string
  size?: "lg" | "md" | "sm"
}) {
  const pad = size === "lg" ? "px-6 py-4" : size === "sm" ? "px-3.5 py-2.5" : "px-5 py-3"
  const inner = (
    <div
      className={`relative rounded-2xl border bg-white/[0.03] ${pad} text-center backdrop-blur-sm transition-colors hover:bg-white/[0.06]`}
      style={{ borderColor: accent ? `${accent}55` : "rgba(255,255,255,0.12)" }}
    >
      {accent && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full" style={{ background: accent }} />}
      <div className={`font-semibold text-white ${size === "lg" ? "text-lg" : size === "sm" ? "text-[13px]" : "text-[15px]"}`}>{title}</div>
      {subtitle && <div className="mt-0.5 text-[11.5px] text-white/45">{subtitle}</div>}
    </div>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  )
}

// A short vertical connector.
function VLine({ h = 24 }: { h?: number }) {
  return <div className="mx-auto w-px bg-white/15" style={{ height: h }} />
}

export function OrgFlowchart() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Parent */}
      <div className="flex justify-center">
        <div className="w-64">
          <Node title="Simplicity" subtitle="Parent company · AI, made in India" size="lg" accent="#ffffff" />
        </div>
      </div>

      <VLine h={28} />

      {/* Two branches: Bench Labs (left) and Partners (right) */}
      <div className="relative">
        {/* horizontal bus */}
        <div className="mx-auto mb-0 h-px w-[70%] bg-white/15" />
        <div className="flex justify-between px-[15%]">
          <VLine h={20} />
          <VLine h={20} />
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {/* Bench Labs branch */}
          <div>
            <Node title="Bench Labs" subtitle="Adopted · open research & AI" href="https://huggingface.co/spaces/bench-labs" accent="#38BDF8" />
            <VLine h={22} />
            {/* sub-projects */}
            <div className="mx-auto mb-0 h-px w-[80%] bg-white/12" />
            <div className="grid grid-cols-3 gap-2 pt-4">
              <Node title="Discord bot" size="sm" accent="#5865F2" />
              <Node title="PixelModel" size="sm" accent="#A78BFA" />
              <Node title="Benchmarks" size="sm" accent="#34D399" />
            </div>
          </div>

          {/* Partners branch */}
          <div>
            <Node title="Partners" subtitle="Research collaborations" accent="#FBBF24" />
            <VLine h={22} />
            <div className="mx-auto h-px w-[50%] bg-white/12" />
            <div className="pt-4">
              <Node title="The ZSMC Co." subtitle="Energy · materials · applied AI" href="https://thezsmc.com" size="sm" accent="#F472B6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
