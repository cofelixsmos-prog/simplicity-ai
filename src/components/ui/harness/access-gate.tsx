"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Share2, Check, Clock } from "lucide-react"

type RequestStatus = "pending" | "approved" | "denied"

// The screen shown when a user without Harness access opens /harness. It states
// that Harness is invite-only and lets them submit a request. If they already
// have a pending/denied request, we show that state instead of the form.
export function HarnessAccessGate({
  initialRequest,
}: {
  initialRequest: { status: RequestStatus; createdAt: number } | null
}) {
  const [reason, setReason] = useState("")
  const [useCase, setUseCase] = useState("")
  const [company, setCompany] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState(initialRequest)

  const submit = async () => {
    if (busy) return
    setError(null)
    if (reason.trim().length < 10) return setError("Tell us a bit more about why you want access.")
    if (useCase.trim().length < 10) return setError("Describe your intended use case.")
    setBusy(true)
    try {
      const res = await fetch("/api/harness/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), useCase: useCase.trim(), company: company.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.")
        setBusy(false)
        return
      }
      setRequest(data.request)
    } catch {
      setError("Network error — please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#08080a] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_20%,rgba(120,120,180,0.10),transparent_70%)]" />

      <div className="relative z-10 w-full max-w-[520px]">
        <Link
          href="/chat"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-white/45 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Back to Simplicity
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]">
            <Share2 className="size-5 text-white/85" strokeWidth={1.6} />
          </span>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">Autonomous orchestration</span>
            <h1 className="text-2xl font-semibold tracking-tight">Harness</h1>
          </div>
        </div>

        {request ? (
          <StatusCard status={request.status} />
        ) : (
          <>
            <p className="mb-7 text-[15px] leading-relaxed text-white/55">
              Harness is currently in limited access. Give one objective and an executive AI spawns
              specialist agents to plan, build, verify, and deliver — you supervise while it works.
              Request access below and we&apos;ll be in touch.
            </p>

            <div className="glass-in rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-7">
              <Field label="Why do you want access?">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="What would you use Harness for?"
                  className="w-full resize-none rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-[15px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
                />
              </Field>

              <Field label="Intended use case">
                <textarea
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="e.g. Automated research reports, multi-step build pipelines…"
                  className="w-full resize-none rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-[15px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
                />
              </Field>

              <Field label="Company" optional>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={200}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35"
                />
              </Field>

              {error && (
                <p className="mt-1 mb-4 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-3.5 py-2.5 text-xs leading-relaxed text-red-200/90">
                  {error}
                </p>
              )}

              <button
                onClick={submit}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Request access
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function StatusCard({ status }: { status: RequestStatus }) {
  const map = {
    pending: {
      icon: <Clock className="size-5 text-amber-300/80" />,
      title: "Request under review",
      body: "Thanks — your request is in. We'll enable Harness on your account once it's approved. You'll see it unlock here.",
    },
    approved: {
      icon: <Check className="size-5 text-emerald-300/80" />,
      title: "You're approved",
      body: "Access has been granted. Reload this page to open the Harness workspace.",
    },
    denied: {
      icon: <Clock className="size-5 text-white/50" />,
      title: "Not enabled yet",
      body: "Your request wasn't approved this time. You're welcome to reach out with more detail about your use case.",
    },
  }[status]

  return (
    <div className="glass-in rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7 text-center shadow-[0_20px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]">
        {map.icon}
      </span>
      <h2 className="text-lg font-semibold text-white">{map.title}</h2>
      <p className="mx-auto mt-2 max-w-[360px] text-[14px] leading-relaxed text-white/55">{map.body}</p>
    </div>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-white/70">
        {label}
        {optional && <span className="text-[11px] font-normal text-white/35">optional</span>}
      </label>
      {children}
    </div>
  )
}
