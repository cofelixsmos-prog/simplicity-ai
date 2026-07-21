import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Footer } from "@/components/ui/footer"

// Shared shell for the legal pages (privacy / terms / cookies) so they share
// one typographic system and stay consistent as they're edited.

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string
  updated: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-24">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to Simplicity
        </Link>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground">{title}</h1>
        <p className="mt-4 text-[13px] text-muted-foreground">Last updated: {updated}</p>
        {intro && <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>}

        <div className="legal-body mt-12">{children}</div>

        <div className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-[13px]">
          <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/cookies" className="text-muted-foreground transition-colors hover:text-foreground">
            Cookie Policy
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[19px] font-semibold tracking-tight text-foreground">{heading}</h2>
      <div className="space-y-4 text-[15px] leading-[1.75] text-muted-foreground">{children}</div>
    </section>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="my-4 list-disc space-y-2 pl-5 marker:text-white/30">
      {items.map((it, i) => (
        <li key={i} className="leading-[1.7]">
          {it}
        </li>
      ))}
    </ul>
  )
}
