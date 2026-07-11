import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"

export interface FAQItem {
  q: string
  a: string
}

// Shared shell for the SEO content pages (/features/*, /for/*) — keeps the
// dark/glass visual language consistent while giving each page room for real,
// crawlable paragraph text (not just visuals) targeting its own keywords.
export function MarketingPage({
  eyebrow,
  title,
  intro,
  children,
  faq,
  ctaText = "Get early access",
  ctaHref = "/register",
}: {
  eyebrow: string
  title: string
  intro: string
  children?: React.ReactNode
  faq?: FAQItem[]
  ctaText?: string
  ctaHref?: string
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-40">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>

        <div className="prose-content mt-14 space-y-8 text-[15px] leading-relaxed text-white/70">
          {children}
        </div>

        {faq && faq.length > 0 && (
          <section className="mt-20" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-foreground">
              Frequently asked questions
            </h2>
            <div className="mt-8 divide-y divide-border border-t border-border">
              {faq.map((item) => (
                <div key={item.q} className="py-6">
                  <h3 className="text-base font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-16 flex flex-wrap gap-3 border-t border-border pt-10">
          <a
            href={ctaHref}
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)]"
          >
            {ctaText}
          </a>
          <a
            href="/"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Back to home
          </a>
        </div>

        {faq && faq.length > 0 && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faq.map((item) => ({
                  "@type": "Question",
                  name: item.q,
                  acceptedAnswer: { "@type": "Answer", text: item.a },
                })),
              }),
            }}
          />
        )}
      </main>

      <Footer />
    </div>
  )
}
