import { MarketingPage } from "@/components/ui/marketing-page"

export const metadata = {
  title: "Simplicity for Students — AI Study Assistant",
  description:
    "Simplicity helps students study with Focus mode's Study level, instant dictionary lookups, essay drafts, and clear explanations — without the distraction of a cluttered AI app.",
  alternates: { canonical: "/for/students" },
}

const FAQ = [
  {
    q: "Is Simplicity free for students?",
    a: "Simplicity is currently in early access — sign up to get access as it rolls out. There's no separate student pricing tier required to use the core chat, focus mode, or document tools.",
  },
  {
    q: "Can Simplicity help me write essays?",
    a: "Yes. Ask for an essay or a draft on any topic and it opens directly in an editable canvas — you can revise it back and forth with Simplicity or edit it yourself, and it stays saved so you can reopen it later.",
  },
  {
    q: "What is Study mode?",
    a: "Study is one of Focus mode's three levels, built specifically for learning sessions — it dims distractions, runs a session timer, and adds an instant dictionary lookup so you can check an unfamiliar word or term without leaving the page.",
  },
  {
    q: "Can it explain concepts, not just answer questions?",
    a: "Yes — Simplicity is built to be direct and clear rather than padded with filler, which makes it well suited to breaking down a concept step by step when you're trying to actually understand something, not just get an answer.",
  },
]

export default function StudentsPage() {
  return (
    <MarketingPage
      eyebrow="Simplicity for · Students"
      title="An AI that helps you study, not just answer."
      intro="Between lectures, readings, and assignments, most students don't need another flashy AI app — they need something that helps them concentrate and actually get through the work. Simplicity's Study mode and document tools are built around exactly that."
      faq={FAQ}
      ctaText="Start studying with Simplicity"
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">Study sessions with fewer distractions</h2>
        <p className="mt-3">
          Turn on Focus mode's Study level before a study block and Simplicity dims the interface,
          starts a visible timer, and keeps its own responses tighter and more direct — closer to a
          study partner than a chatbot. An inline dictionary lookup means you don't have to open a
          new tab just to check a word.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Essays and assignments that stay editable</h2>
        <p className="mt-3">
          Ask for a draft — an essay, a summary, a set of notes — and it opens in a dedicated editor
          canvas rather than sitting as plain text in the chat. You can revise it together with
          Simplicity or edit it directly, and it's saved as a reopenable draft you can come back to.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Reports and slides for group projects</h2>
        <p className="mt-3">
          Need a project report or a presentation deck? Simplicity generates a real, downloadable
          PDF or PowerPoint file with proper structure and formatting — not just a wall of text you
          have to reformat yourself before turning it in.
        </p>
      </div>
    </MarketingPage>
  )
}
