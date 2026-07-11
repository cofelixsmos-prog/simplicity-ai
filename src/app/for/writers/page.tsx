import { MarketingPage } from "@/components/ui/marketing-page"

export const metadata = {
  title: "Simplicity for Writers — AI Writing Assistant",
  description:
    "Simplicity gives writers an editable draft canvas, Deep focus mode for uninterrupted sessions, and the ability to turn finished work into polished PDFs — all in one calm assistant.",
  alternates: { canonical: "/for/writers" },
}

const FAQ = [
  {
    q: "Can Simplicity write a full draft, not just suggestions?",
    a: "Yes. Ask for an essay, article, or any long-form document and Simplicity writes the full draft and opens it in an editable canvas, ready for you to revise, extend, or rewrite sections of.",
  },
  {
    q: "Does it help with revisions, or only first drafts?",
    a: "Both — call it back with changes (\"make the tone more casual\", \"expand the third section\") and it updates the same draft in place, keeping your existing structure rather than starting over.",
  },
  {
    q: "Can I export finished writing as a real document?",
    a: "Yes. Once a piece is done, Simplicity can format it into a polished PDF with proper headings, sections, and callouts — a genuine downloadable file, not just exported chat text.",
  },
  {
    q: "How does Focus mode help with writing specifically?",
    a: "Deep focus mode dims the interface and keeps a session timer running so you can settle into a long writing block without the visual noise of a typical app, while Simplicity's own responses stay concise so it doesn't interrupt your flow.",
  },
]

export default function WritersPage() {
  return (
    <MarketingPage
      eyebrow="Simplicity for · Writers"
      title="A calm place to draft, revise, and finish."
      intro="Writing needs long, uninterrupted stretches of attention — the opposite of what most AI chat tools are designed for. Simplicity pairs a genuine draft editor with a focus mode built for deep sessions, so the tool gets out of the way instead of adding to the noise."
      faq={FAQ}
      ctaText="Start writing with Simplicity"
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">An editable draft, not a chat transcript</h2>
        <p className="mt-3">
          When you ask for a piece of writing, Simplicity opens it in a dedicated draft canvas
          instead of burying it in the chat log. You can revise it conversationally — "tighten the
          opening", "add a section on X" — and each change updates the same document in place.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Deep focus for long writing sessions</h2>
        <p className="mt-3">
          Switch to Deep focus mode before a serious writing block. The interface dims around your
          draft, a session timer keeps you honest about how long you've been at it, and Simplicity's
          own tone tightens up — fewer tangents, more direct help finishing the thing in front of you.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">From draft to finished document</h2>
        <p className="mt-3">
          When a piece is ready, Simplicity can turn it into a properly formatted PDF — with real
          headings, structure, and styling — so the last step from "finished draft" to
          "something you can send or submit" doesn't require reformatting it yourself in another app.
        </p>
      </div>
    </MarketingPage>
  )
}
