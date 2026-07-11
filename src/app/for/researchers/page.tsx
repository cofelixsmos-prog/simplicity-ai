import { MarketingPage } from "@/components/ui/marketing-page"

export const metadata = {
  title: "Simplicity for Researchers — AI Research Assistant",
  description:
    "Simplicity's agent swarm runs research in parallel with writing and analysis, grounds answers in live web search with citations, and turns findings into real PDF or Excel documents.",
  alternates: { canonical: "/for/researchers" },
}

const FAQ = [
  {
    q: "Does Simplicity search the web for real information?",
    a: "Yes. Its research tool uses live web search with citations, so answers on current events, recent data, or niche topics are grounded in actual sources rather than guesswork.",
  },
  {
    q: "Can it handle a multi-part research task on its own?",
    a: "Yes — for larger requests, Simplicity's agent swarm splits the work: a research sub-agent gathers and grounds information while a writer sub-agent drafts the summary, running in parallel rather than one after another.",
  },
  {
    q: "Can findings be turned into a report or spreadsheet?",
    a: "Yes. Once research is done, ask for a PDF report with headings, tables, and callouts, or an Excel spreadsheet with the underlying data — both come out as real, downloadable, properly formatted files.",
  },
  {
    q: "Does Simplicity remember context across research sessions?",
    a: "Yes — Simplicity keeps a lasting memory of durable facts and ongoing projects you've mentioned, so it can recall the context of a research thread across separate conversations instead of starting from zero each time.",
  },
]

export default function ResearchersPage() {
  return (
    <MarketingPage
      eyebrow="Simplicity for · Researchers"
      title="Research, grounded, delegated, and delivered."
      intro="Research work is rarely one step — it's searching, synthesizing, writing up, and packaging findings into something shareable. Simplicity's agent swarm and live web search are built to handle that whole chain, not just answer a single question."
      faq={FAQ}
      ctaText="Start researching with Simplicity"
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">Grounded answers, with citations</h2>
        <p className="mt-3">
          Simplicity's research tool runs live web search rather than relying purely on training
          data, so questions about recent events, current data, or specialized topics come back
          grounded in real sources — with citations you can verify, not confident-sounding guesses.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Parallel work for multi-part research</h2>
        <p className="mt-3">
          A request like "research this topic and write up a summary with a chart" doesn't have to
          happen step by step. Simplicity's agent swarm can run a research sub-agent and a writer
          sub-agent in parallel, each with a clear, focused task, so the whole request comes together
          faster than working through it sequentially.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">From findings to a real deliverable</h2>
        <p className="mt-3">
          Once the research is done, turn it directly into a polished PDF report with structured
          headings and callouts, or an Excel spreadsheet if the findings are numeric — both are real
          files you can download, share, or attach to an email through Simplicity's Gmail
          integration, without leaving the conversation.
        </p>
      </div>
    </MarketingPage>
  )
}
