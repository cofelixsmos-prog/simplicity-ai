"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Cookie, X } from "lucide-react"

// Cookie consent. Simplicity only sets one strictly-necessary cookie (the login
// session), so this is deliberately honest and lightweight rather than a
// dark-pattern wall: nothing is hidden behind "Accept", and declining optional
// categories costs the user nothing.

const LS_CONSENT = "sx-consent"
const CONSENT_VERSION = 1
const OPEN_EVENT = "sx-open-cookie-settings"

export interface ConsentState {
  version: number
  necessary: true // always on — the app can't run without a session cookie
  preferences: boolean // remembering theme / ambient settings on this device
  decidedAt: number
}

function read(): ConsentState | null {
  try {
    const raw = localStorage.getItem(LS_CONSENT)
    if (!raw) return null
    const o = JSON.parse(raw) as ConsentState
    if (o.version !== CONSENT_VERSION) return null // re-ask when the policy changes
    return o
  } catch {
    return null
  }
}

function write(preferences: boolean) {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    necessary: true,
    preferences,
    decidedAt: Date.now(),
  }
  try {
    localStorage.setItem(LS_CONSENT, JSON.stringify(state))
  } catch {}
  window.dispatchEvent(new CustomEvent("sx-consent-changed", { detail: state }))
}

/** Read the current choice — use this before storing any optional preference. */
export function hasPreferenceConsent(): boolean {
  return read()?.preferences ?? false
}

/** Opens the cookie settings panel from anywhere (e.g. the Cookie Policy page). */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-white/30 hover:bg-white/[0.08]"
    >
      <Cookie className="size-3.5" />
      Cookie settings
    </button>
  )
}

export function CookieConsent() {
  const [show, setShow] = useState(false)
  const [panel, setPanel] = useState(false)
  const [prefs, setPrefs] = useState(true)

  useEffect(() => {
    const existing = read()
    if (!existing) setShow(true)
    else setPrefs(existing.preferences)

    const open = () => {
      const cur = read()
      setPrefs(cur?.preferences ?? true)
      setPanel(true)
      setShow(true)
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])

  const decide = useCallback((preferences: boolean) => {
    write(preferences)
    setPanel(false)
    setShow(false)
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-4 sm:p-6" role="dialog" aria-label="Cookie notice">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/12 bg-black/85 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        {!panel ? (
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
            <div className="flex min-w-0 flex-1 gap-3.5">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Cookie className="size-4 text-white/70" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-white">We keep cookies to a minimum</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                  One cookie keeps you signed in. We also remember your theme on this device. No ads, no
                  tracking, no third-party analytics.{" "}
                  <Link
                    href="/cookies"
                    className="text-white/80 underline decoration-white/25 underline-offset-2 hover:decoration-white"
                  >
                    Learn more
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                onClick={() => setPanel(true)}
                className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
              >
                Customize
              </button>
              <button
                onClick={() => decide(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
              >
                Necessary only
              </button>
              <button
                onClick={() => decide(true)}
                className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
              >
                Accept
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[15px] font-semibold text-white">Cookie settings</p>
                <p className="mt-1 text-[13px] text-white/50">Choose what Simplicity may store on this device.</p>
              </div>
              <button
                onClick={() => {
                  setPanel(false)
                  if (read()) setShow(false)
                }}
                aria-label="Close"
                className="flex size-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-white">Strictly necessary</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/45">
                      The login session cookie. Without it you can&apos;t stay signed in.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/12 px-2.5 py-1 text-[11px] font-medium text-white/45">
                    Always on
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPrefs((v) => !v)}
                role="switch"
                aria-checked={prefs}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05]"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-white">Preferences</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-white/45">
                    Remember your background theme and ambient settings on this device. Never sent to us.
                  </span>
                </span>
                <span
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${
                    prefs ? "bg-white" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full transition-all duration-200 ${
                      prefs ? "left-[1.125rem] bg-black" : "left-0.5 bg-white"
                    }`}
                  />
                </span>
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/cookies"
                className="text-[12.5px] text-white/45 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
              >
                Read the Cookie Policy
              </Link>
              <button
                onClick={() => decide(prefs)}
                className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
              >
                Save choices
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
