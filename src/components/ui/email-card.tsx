"use client"

import { useEffect, useRef, useState } from "react"
import { Mail, Send, X, Check, Loader2, AlertTriangle, Undo2, ChevronDown, Paperclip } from "lucide-react"

// An email (or batch) staged by the AI, awaiting the user's explicit approval.
// The AI never sends — this card is the only path to /api/email/send, and it
// only fires on a human click, after a 15-second undo window.
export interface StagedEmail {
  to: string
  subject: string
  body: string
  attachments?: { id: string; name: string }[]
}

type Phase = "review" | "countdown" | "sending" | "done"
const UNDO_SECONDS = 15

interface SendResult {
  to: string
  ok: boolean
  error?: string
}

export function EmailApprovalCard({ emails }: { emails: StagedEmail[] }) {
  // Local editable copies so the user can tweak before sending ([Edit]).
  const [items, setItems] = useState<StagedEmail[]>(() => emails.map((e) => ({ ...e })))
  const [phase, setPhase] = useState<Phase>("review")
  const [countdown, setCountdown] = useState(UNDO_SECONDS)
  const [results, setResults] = useState<SendResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ token: string; count: number; external: number } | null>(null)
  const [confirmInput, setConfirmInput] = useState("")
  const [openIdx, setOpenIdx] = useState<number | null>(emails.length === 1 ? 0 : null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const batch = items.length > 1

  const patch = (i: number, field: keyof StagedEmail, v: string) =>
    setItems((arr) => arr.map((e, idx) => (idx === i ? { ...e, [field]: v } : e)))

  // The undo countdown: once it hits 0, the send actually fires.
  useEffect(() => {
    if (phase !== "countdown") return
    if (countdown <= 0) {
      doSend()
      return
    }
    timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  function startCountdown() {
    setError(null)
    setCountdown(UNDO_SECONDS)
    setPhase("countdown")
  }

  function undo() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase("review")
  }

  async function doSend(confirmToken?: string) {
    setPhase("sending")
    setError(null)
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: items, confirm: confirmToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.needConfirm) {
        setConfirm({ token: data.confirmToken, count: data.count, external: data.external })
        setPhase("review")
        return
      }
      if (!res.ok) {
        setError(data?.error ?? "Send failed.")
        setPhase("review")
        return
      }
      setResults(data.results ?? [])
      setConfirm(null)
      setPhase("done")
    } catch {
      setError("Network error — please try again.")
      setPhase("review")
    }
  }

  // ── Done: per-recipient outcome ────────────────────────────────────────────
  if (phase === "done" && results) {
    const sent = results.filter((r) => r.ok).length
    const failed = results.length - sent
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="size-4 text-emerald-300" />
          </span>
          <span className="text-sm font-medium text-white">
            {sent} sent{failed > 0 ? `, ${failed} failed` : ""}
          </span>
        </div>
        <ul className="divide-y divide-white/5">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
              {r.ok ? (
                <Check className="size-4 shrink-0 text-emerald-300" />
              ) : (
                <X className="size-4 shrink-0 text-red-300" />
              )}
              <span className="truncate text-white/80">{r.to}</span>
              {r.error && <span className="ml-auto truncate text-xs text-red-300/80">{r.error}</span>}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const sending = phase === "sending"
  const counting = phase === "countdown"

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-white/10">
          <Mail className="size-4 text-white/80" />
        </span>
        <span className="text-sm font-medium text-white">
          {batch ? `${items.length} emails ready` : "Ready to send"}
        </span>
      </div>

      {/* email list */}
      <div className={`divide-y divide-white/5 ${batch ? "max-h-[380px] overflow-y-auto" : ""}`}>
        {items.map((e, i) => {
          const open = openIdx === i
          const editable = phase === "review"
          return (
            <div key={i} className="px-4 py-3">
              {batch && (
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white/90">{e.to || "(no recipient)"}</span>
                    <span className="block truncate text-xs text-white/45">{e.subject || "(no subject)"}</span>
                  </span>
                  {e.attachments && e.attachments.length > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-white/40">
                      <Paperclip className="size-3" />
                      {e.attachments.length}
                    </span>
                  )}
                  <ChevronDown className={`size-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              )}

              {(open || !batch) && (
                <div className={`space-y-2 ${batch ? "mt-3" : ""}`}>
                  <LabeledInput label="To" value={e.to} onChange={(v) => patch(i, "to", v)} disabled={!editable} />
                  <LabeledInput
                    label="Subject"
                    value={e.subject}
                    onChange={(v) => patch(i, "subject", v)}
                    disabled={!editable}
                  />
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">Body</span>
                    <textarea
                      value={e.body}
                      onChange={(ev) => patch(i, "body", ev.target.value)}
                      disabled={!editable}
                      rows={batch ? 4 : 6}
                      className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[13px] leading-relaxed text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-white/35 disabled:opacity-70"
                    />
                  </label>
                  {e.attachments && e.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {e.attachments.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs text-white/60"
                        >
                          <Paperclip className="size-3 text-white/40" />
                          <span className="max-w-[180px] truncate">{a.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* batch-safety confirmation gate */}
      {confirm && phase === "review" && (
        <div className="border-t border-amber-400/20 bg-amber-500/[0.06] px-4 py-3">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-100/90">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
            <span>
              You&apos;re about to send <b>{confirm.count} emails</b>
              {confirm.external > 0 ? ` (${confirm.external} to outside addresses)` : ""}. Type{" "}
              <b className="font-mono">{confirm.token}</b> to confirm.
            </span>
          </p>
          <input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={confirm.token}
            className="mt-2 w-full rounded-lg border border-amber-400/30 bg-black/20 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-300/60"
          />
        </div>
      )}

      {error && (
        <p className="border-t border-red-400/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">{error}</p>
      )}

      {/* actions */}
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
        {counting ? (
          <>
            <button
              onClick={undo}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Undo2 className="size-4" />
              Undo
            </button>
            <span className="text-sm text-white/50">Sending in {countdown}s…</span>
          </>
        ) : confirm ? (
          <button
            onClick={() => doSend(confirmInput.trim())}
            disabled={sending || confirmInput.trim().toUpperCase() !== confirm.token.toUpperCase()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Confirm & send {confirm.count}
          </button>
        ) : (
          <button
            onClick={startCountdown}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {batch ? `Approve all ${items.length}` : "Send"}
          </button>
        )}
      </div>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-white/90 outline-none transition-colors focus:border-white/35 disabled:opacity-70"
      />
    </label>
  )
}
