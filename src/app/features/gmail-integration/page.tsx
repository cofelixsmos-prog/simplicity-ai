import { MarketingPage } from "@/components/ui/marketing-page"

export const metadata = {
  title: "Gmail Integration — Send & Manage Email from AI Chat",
  description:
    "Connect Gmail to Simplicity with secure Google sign-in. Read, search, draft, and send email from chat — every send requires your explicit approval first.",
  alternates: { canonical: "/features/gmail-integration" },
}

const FAQ = [
  {
    q: "How does Simplicity connect to Gmail?",
    a: "Through Google's own OAuth sign-in, set up from the Settings page — Simplicity never asks for or stores your Google password. You approve exactly which permissions to grant (Gmail, Google Drive, or both), and you can disconnect at any time.",
  },
  {
    q: "Can Simplicity send emails without asking me first?",
    a: "No. When you ask Simplicity to send an email, it prepares a draft — recipient, subject, and body — and shows you an approval card in chat. Nothing is sent until you review it and click Send yourself.",
  },
  {
    q: "What can Simplicity do with my inbox?",
    a: "Once connected, it can read and search your inbox, reply to or forward messages, mark emails read/unread or archive them, move messages to trash (with a confirmation step), and save drafts — all from natural conversation instead of switching to Gmail.",
  },
  {
    q: "Is my Gmail data secure?",
    a: "Yes. OAuth refresh tokens are encrypted at rest (AES-256-GCM) before being stored, and every email-sending or inbox-modifying action requires your explicit confirmation — Simplicity is designed so a stray instruction can't silently send or delete anything.",
  },
]

export default function GmailIntegrationPage() {
  return (
    <MarketingPage
      eyebrow="Features · Gmail integration"
      title="Your inbox, handled from the conversation."
      intro="Instead of switching tabs to draft a reply or check whether an email came in, Simplicity can read, write, and manage your Gmail right inside the chat — with a secure Google sign-in and a manual approval step before anything is ever sent."
      faq={FAQ}
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">Secure sign-in, not a password field</h2>
        <p className="mt-3">
          Connecting Gmail happens through Google's own consent screen — you'll see exactly which
          permissions are being requested (send email, read your inbox, and optionally Google
          Drive access) before you approve anything. Simplicity never sees or stores your Google
          password; only an encrypted, revocable access token.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Draft, review, then send — never automatic</h2>
        <p className="mt-3">
          Ask Simplicity to email someone and it prepares the message as a card in the conversation:
          recipient, subject line, and body, ready for you to edit. Sending only happens when you
          click Send on that card — there's no path where the assistant emails someone without a
          human clicking a button first.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Full inbox management, in plain language</h2>
        <p className="mt-3">
          Beyond sending, you can ask Simplicity to find a specific email, summarize your unread
          messages, reply to a thread, archive something, or clean up old messages — reversible
          actions like archiving apply immediately, while anything destructive (like moving mail to
          trash) still asks for confirmation first.
        </p>
      </div>
    </MarketingPage>
  )
}
