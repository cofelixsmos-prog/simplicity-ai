import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, Section, Bullets } from "@/components/ui/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Simplicity collects, uses, stores and protects your data — written in plain language.",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="19 July 2026"
      intro="This policy explains what Simplicity collects, why, and what control you have over it. We've written it in plain language rather than legalese."
    >
      <Section heading="Who we are">
        <p>
          Simplicity is an AI assistant operated from India. In this policy, &ldquo;we&rdquo;, &ldquo;us&rdquo;
          and &ldquo;Simplicity&rdquo; refer to the service and its operators, and &ldquo;you&rdquo; refers to
          anyone using it.
        </p>
      </Section>

      <Section heading="What we collect">
        <p>We collect only what the product needs to function:</p>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Account details</strong> — your email address, your
              name if you provide one, and a securely hashed password. We never store your password in
              readable form.
            </>,
            <>
              <strong className="text-foreground">Your conversations</strong> — the messages you send
              and the assistant&apos;s replies, so your chat history is there when you return.
            </>,
            <>
              <strong className="text-foreground">Things you create</strong> — documents, presentations,
              apps and files generated in the product.
            </>,
            <>
              <strong className="text-foreground">Memories</strong> — short facts the assistant saves
              about your preferences, which you can view and delete at any time in Settings.
            </>,
            <>
              <strong className="text-foreground">Uploads</strong> — files you attach. These are
              automatically deleted after 24 hours.
            </>,
            <>
              <strong className="text-foreground">Session data</strong> — a login cookie so you stay
              signed in. See our <Link href="/cookies" className="text-foreground underline decoration-white/25 underline-offset-2 hover:decoration-white">Cookie Policy</Link>.
            </>,
            <>
              <strong className="text-foreground">Optional Gmail access</strong> — only if you connect
              Gmail. Credentials are encrypted, and email is only ever sent after you explicitly approve
              it. You can disconnect at any time.
            </>,
          ]}
        />
        <p>
          We do <strong className="text-foreground">not</strong> sell your data, use it for advertising,
          or build advertising profiles about you.
        </p>
      </Section>

      <Section heading="How your messages are processed">
        <p>
          To generate replies, the content of your conversation is sent to third-party AI model
          providers that run the underlying models. These providers process your messages to produce a
          response. We send only what is needed to answer you, and we do not send your email address,
          password or account identifiers along with it.
        </p>
        <p>
          If you use the web-search capability, your search query — not your whole conversation — is
          sent to a search provider.
        </p>
        <p>
          Please avoid sharing highly sensitive information (government identifiers, financial account
          numbers, health records, passwords) in your conversations.
        </p>
      </Section>

      <Section heading="Where your data is stored">
        <p>
          Your account and conversation data is stored in a managed database hosted in the Asia-Pacific
          (Mumbai) region. Data may be processed in other countries where our AI providers operate.
          Secrets such as connected-account credentials are encrypted before storage.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <Bullets
          items={[
            <>Conversations and created files: kept until you delete them or close your account.</>,
            <>Uploaded files: automatically deleted after 24 hours.</>,
            <>Login sessions: expire after 30 days of inactivity.</>,
            <>Memories: kept until you delete them; older ones are pruned automatically.</>,
          ]}
        />
      </Section>

      <Section heading="Your rights and controls">
        <p>You can, at any time:</p>
        <Bullets
          items={[
            <>Read, edit and delete individual conversations.</>,
            <>View and clear everything the assistant has remembered about you.</>,
            <>Disconnect Gmail, which immediately removes the stored credentials.</>,
            <>Change your cookie preferences.</>,
            <>Request a copy of your data, or ask us to delete your account entirely.</>,
          ]}
        />
        <p>
          Depending on where you live, you may also have rights under laws such as India&apos;s Digital
          Personal Data Protection Act, the GDPR, or the CCPA — including access, correction, deletion,
          and the right to object to certain processing. Contact us to exercise any of these.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          Passwords are hashed with scrypt. Session tokens are stored only as hashes, so a leaked
          database backup cannot be replayed as live logins. Connected-account secrets are encrypted at
          rest, and traffic is served over HTTPS.
        </p>
        <p>
          No system is perfectly secure. If you believe you&apos;ve found a vulnerability, please contact
          us rather than disclosing it publicly.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          Simplicity is not intended for children under 13, and we do not knowingly collect their data.
          If you believe a child has created an account, contact us and we will remove it.
        </p>
      </Section>

      <Section heading="Changes to this policy">
        <p>
          If we make a material change, we will update the date at the top of this page and, where
          appropriate, notify you in the product.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions, requests, or complaints about privacy can be sent to the contact address listed on
          our site. We aim to respond within 30 days.
        </p>
      </Section>
    </LegalPage>
  )
}
