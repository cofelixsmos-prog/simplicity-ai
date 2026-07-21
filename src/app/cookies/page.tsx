import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, Section } from "@/components/ui/legal-page"
import { CookieSettingsButton } from "@/components/ui/cookie-consent"

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "What Simplicity stores in your browser, and why.",
}

function Row({ name, type, purpose, life }: { name: string; type: string; purpose: string; life: string }) {
  return (
    <tr>
      <td className="border-b border-white/[0.06] px-3.5 py-3 align-top font-mono text-[12.5px] text-foreground">
        {name}
      </td>
      <td className="border-b border-white/[0.06] px-3.5 py-3 align-top text-[13.5px]">{type}</td>
      <td className="border-b border-white/[0.06] px-3.5 py-3 align-top text-[13.5px]">{purpose}</td>
      <td className="border-b border-white/[0.06] px-3.5 py-3 align-top text-[13.5px]">{life}</td>
    </tr>
  )
}

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="19 July 2026"
      intro="Simplicity uses very few cookies. We don't use advertising or cross-site tracking cookies at all."
    >
      <Section heading="The short version">
        <p>
          We use <strong className="text-foreground">one</strong> cookie, and it exists so you stay
          logged in. Everything else we store — your theme, ambient preferences — stays in your
          browser&apos;s local storage and is never sent to us or to anyone else.
        </p>
      </Section>

      <Section heading="Strictly necessary cookies">
        <p>
          These are required for the service to work. They can&apos;t be switched off, because without
          them you couldn&apos;t sign in.
        </p>
        <div className="my-5 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Name</th>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Type</th>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Purpose</th>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Expires</th>
              </tr>
            </thead>
            <tbody>
              <Row
                name="sid"
                type="Cookie (httpOnly)"
                purpose="Keeps you signed in. Contains a random token only — no personal data. It can't be read by JavaScript."
                life="30 days, extended while you keep using the app"
              />
            </tbody>
          </table>
        </div>
      </Section>

      <Section heading="Preferences stored on your device">
        <p>
          These are stored in your browser&apos;s local storage, not as cookies. They never leave your
          device, and clearing your browser data removes them.
        </p>
        <div className="my-5 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Key</th>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Type</th>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Purpose</th>
                <th className="border-b border-white/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground/70">Expires</th>
              </tr>
            </thead>
            <tbody>
              <Row name="sx-consent" type="Local storage" purpose="Remembers your cookie choice so we stop asking." life="12 months" />
              <Row name="sx-bg-theme" type="Local storage" purpose="Your chosen background animation." life="Until cleared" />
              <Row name="sx-night / sx-auto-night" type="Local storage" purpose="Night-mode preference and whether it follows the clock." life="Until cleared" />
              <Row name="sx-auto-morning" type="Local storage" purpose="Whether the morning ambient tint is enabled." life="Until cleared" />
            </tbody>
          </table>
        </div>
      </Section>

      <Section heading="What we don't use">
        <p>
          No advertising cookies. No cross-site tracking. No third-party analytics or marketing pixels.
          We don&apos;t sell or share your browsing behaviour.
        </p>
      </Section>

      <Section heading="Managing your choices">
        <p>
          You can change your choice at any time, or clear cookies and site data from your browser
          settings. Note that clearing the <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-foreground">sid</code>{" "}
          cookie will sign you out.
        </p>
        <div className="mt-5">
          <CookieSettingsButton />
        </div>
      </Section>

      <Section heading="More information">
        <p>
          See our{" "}
          <Link href="/privacy" className="text-foreground underline decoration-white/25 underline-offset-2 hover:decoration-white">
            Privacy Policy
          </Link>{" "}
          for how we handle personal data more broadly.
        </p>
      </Section>
    </LegalPage>
  )
}
