import { MarketingPage } from "@/components/ui/marketing-page"

export const metadata = {
  title: "Document Generation — AI-Made PDFs, Slides & Spreadsheets",
  description:
    "Ask Simplicity for a PDF report, PowerPoint deck, or Excel spreadsheet. It designs the document, shows a live preview in chat, and hands you a real downloadable file.",
  alternates: { canonical: "/features/document-generation" },
}

const FAQ = [
  {
    q: "What kinds of documents can Simplicity generate?",
    a: "Polished PDF reports with headings, tables, and callouts; PowerPoint-style slide decks with title, content, metrics, and quote layouts; and Excel spreadsheets with multiple sheets, formatted columns, and real numeric data you can sort and calculate on.",
  },
  {
    q: "Do I get a real downloadable file, or just a preview?",
    a: "Both. Every document renders as a live, styled preview directly in the chat, and a genuine .pdf, .pptx, or .xlsx file is generated at the same time — so what you see is exactly what downloads.",
  },
  {
    q: "Can a generated PDF be attached to an email automatically?",
    a: "Yes. Once Simplicity creates a PDF, it can attach that exact file when preparing an email — you'll see it staged as an attachment on the approval card before you send.",
  },
  {
    q: "Do documents show up again if I reload the conversation?",
    a: "Yes — generated documents, drafts, and staged emails are saved as reopenable artifacts. Reloading a past conversation restores them exactly as they were, including whether an email was already sent.",
  },
]

export default function DocumentGenerationPage() {
  return (
    <MarketingPage
      eyebrow="Features · Document generation"
      title="Real documents, not just text in a chat window."
      intro="A lot of AI tools describe a report instead of producing one. Simplicity actually designs the PDF, the slide deck, or the spreadsheet — with real formatting, real charts and tables — and gives you a genuine file to download, not a wall of markdown."
      faq={FAQ}
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">PDF reports with real structure</h2>
        <p className="mt-3">
          Ask for a report and Simplicity builds it from proper document blocks — headings, body
          paragraphs, bulleted or numbered lists, data tables, and highlighted callouts for key
          takeaways — rendered with a branded accent color and a clean typographic layout, not a
          plain text dump.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Slide decks that look designed</h2>
        <p className="mt-3">
          Presentations come out as full slide decks with distinct layouts — title slides, section
          dividers, metrics grids, side-by-side columns, quotes, and a closing slide — plus charts
          embedded directly into content slides where the data calls for it.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Spreadsheets that behave like spreadsheets</h2>
        <p className="mt-3">
          Excel exports keep numbers as real numbers (not text), apply proper column formatting
          like currency and percentages, support multiple sheets in one file, and come with a
          styled header, banded rows, and filters already turned on — ready to sort, filter, and
          calculate the moment you open it.
        </p>
      </div>
    </MarketingPage>
  )
}
