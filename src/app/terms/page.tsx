import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, Section, Bullets } from "@/components/ui/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms and conditions for using Simplicity.",
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="19 July 2026"
      intro="These terms (also referred to as our Terms and Conditions) set out the agreement between you and Simplicity. By creating an account or using the service, you agree to them."
    >
      <Section heading="1. Using Simplicity">
        <p>
          You must be at least 13 years old to use Simplicity. If you are under 18, you should have
          permission from a parent or guardian. You are responsible for the activity that happens under
          your account, and for keeping your password secure.
        </p>
      </Section>

      <Section heading="2. Acceptable use">
        <p>You agree not to use Simplicity to:</p>
        <Bullets
          items={[
            <>Break the law, or help anyone else do so.</>,
            <>Create or distribute malware, or attack systems you don&apos;t own or have permission to test.</>,
            <>Harass, threaten, defame or impersonate anyone.</>,
            <>Generate sexual content involving minors, or content that incites violence against people.</>,
            <>Send spam or bulk unsolicited email through the Gmail integration.</>,
            <>Scrape, resell or redistribute the service, or attempt to bypass rate limits and access controls.</>,
            <>Present AI-generated output as professional legal, medical or financial advice.</>,
          ]}
        />
        <p>
          We may suspend or terminate accounts that break these rules, and where necessary we will act
          without prior notice.
        </p>
      </Section>

      <Section heading="3. Your content">
        <p>
          You keep ownership of what you put into Simplicity and what you create with it. You grant us a
          limited licence to store and process that content solely to operate the service for you — for
          example, sending your message to an AI provider to produce a reply, or saving a document you
          generated.
        </p>
        <p>
          You are responsible for making sure you have the right to submit the content you provide.
        </p>
      </Section>

      <Section heading="4. AI output — important limitations">
        <p>
          Simplicity produces AI-generated content. It can be inaccurate, incomplete, outdated, or
          confidently wrong. It may misinterpret your request.
        </p>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Always verify anything important</strong> before relying
              on it, especially facts, figures, citations and code.
            </>,
            <>
              Output is <strong className="text-foreground">not</strong> legal, medical, financial or
              professional advice.
            </>,
            <>Similar prompts may produce different results, and output may resemble that of other users.</>,
          ]}
        />
        <p>You are responsible for how you use what the assistant produces.</p>
      </Section>

      <Section heading="5. Email and connected accounts">
        <p>
          If you connect Gmail, Simplicity can draft emails on your behalf — but nothing is ever sent
          without you explicitly reviewing and approving it. You remain responsible for every message
          sent from your account. You can disconnect at any time from Settings.
        </p>
      </Section>

      <Section heading="6. Availability and changes">
        <p>
          We provide the service on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We may
          change, suspend or discontinue features, apply usage limits, or perform maintenance. We don&apos;t
          guarantee uninterrupted or error-free operation.
        </p>
      </Section>

      <Section heading="7. Liability">
        <p>
          To the fullest extent permitted by law, Simplicity is not liable for indirect, incidental,
          special or consequential damages, or for lost profits, lost data, or business interruption
          arising from your use of the service.
        </p>
        <p>
          Nothing in these terms limits liability that cannot be limited by law, such as for fraud or
          death or personal injury caused by negligence.
        </p>
      </Section>

      <Section heading="8. Ending your account">
        <p>
          You can stop using Simplicity and request deletion of your account at any time. We may suspend
          or terminate access if you breach these terms, if required by law, or if continuing to provide
          the service becomes impractical.
        </p>
      </Section>

      <Section heading="9. Changes to these terms">
        <p>
          We may update these terms. If a change is material, we will update the date above and, where
          appropriate, notify you in the product. Continuing to use Simplicity after a change means you
          accept the updated terms.
        </p>
      </Section>

      <Section heading="10. Governing law">
        <p>
          These terms are governed by the laws of India, and the courts of India will have jurisdiction
          over any dispute — without affecting any mandatory consumer-protection rights you have where
          you live.
        </p>
      </Section>

      <Section heading="11. Privacy">
        <p>
          Our{" "}
          <Link
            href="/privacy"
            className="text-foreground underline decoration-white/25 underline-offset-2 hover:decoration-white"
          >
            Privacy Policy
          </Link>{" "}
          explains how we handle your data and forms part of these terms.
        </p>
      </Section>
    </LegalPage>
  )
}
