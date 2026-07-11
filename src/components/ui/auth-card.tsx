"use client"

import { useRef, useState, type InputHTMLAttributes } from "react"
import Link from "next/link"
import { Loader2, ArrowRight, ArrowLeft, Moon, Sunrise, LogIn } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { DEFAULT_SETTINGS } from "@/lib/settings"

// The sign-up / log-in experience, built to feel like the chat itself: a single
// glass box floating over the animated shader, one question at a time, sliding
// forward with a small spoken affirmation between the key steps. Register also
// collects the user's own "rules" (a custom system prompt) and a couple of
// ambient preferences before handing off to the welcome moment on /chat.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type RegisterStep = "name" | "email" | "password" | "rules" | "settings"
type LoginStep = "email" | "password"
type Step = RegisterStep | LoginStep

const REGISTER_STEPS: RegisterStep[] = ["name", "email", "password", "rules", "settings"]
const LOGIN_STEPS: LoginStep[] = ["email", "password"]

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register"
  const steps: Step[] = isRegister ? REGISTER_STEPS : LOGIN_STEPS

  const [idx, setIdx] = useState(0)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rules, setRules] = useState("")
  const [autoNight, setAutoNight] = useState(DEFAULT_SETTINGS.autoNight)
  const [autoMorning, setAutoMorning] = useState(DEFAULT_SETTINGS.autoMorning)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // A brief spoken affirmation shown between steps ("Nice name.", "All done.").
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const step = steps[idx]
  const firstName = name.trim().split(/\s+/)[0] || ""
  const isLast = idx === steps.length - 1

  // Validate the current step's input. Returns an error string, or null if ok.
  function validate(): string | null {
    if (step === "name" && !name.trim()) return "Tell me your name to continue."
    if (step === "email" && !EMAIL_RE.test(email.trim())) return "Enter a valid email address."
    if (step === "password") {
      if (isRegister && password.length < 8) return "Password must be at least 8 characters."
      if (!isRegister && !password) return "Enter your password."
    }
    return null
  }

  // The affirmation to speak when leaving a given step (register only — login
  // is short and stays quiet until the welcome moment).
  function affirmationFor(s: Step): string | null {
    if (!isRegister) return null
    if (s === "name") return `Nice name, ${firstName}.`
    if (s === "password") return "All done."
    return null
  }

  function goNext() {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    if (isLast) {
      submit()
      return
    }
    const say = affirmationFor(step)
    if (say) {
      setFlash(say)
      flashTimer.current = setTimeout(() => {
        setFlash(null)
        setIdx((i) => i + 1)
      }, 2400)
    } else {
      setIdx((i) => i + 1)
    }
  }

  function goBack() {
    if (busy || flash) return
    setError(null)
    setIdx((i) => Math.max(0, i - 1))
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const body = isRegister
        ? {
            name: name.trim(),
            email: email.trim(),
            password,
            systemPrompt: rules.trim() || undefined,
            settings: { autoNight, autoMorning },
          }
        : { email: email.trim(), password }
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.")
        // Send them back to the step most likely at fault.
        if (isRegister && /email/i.test(data.error ?? "")) setIdx(REGISTER_STEPS.indexOf("email"))
        setBusy(false)
        return
      }
      try {
        sessionStorage.setItem("sx-just-logged-in", "1")
        sessionStorage.setItem("sx-welcome-kind", mode)
      } catch {}
      window.location.href = "/chat"
    } catch {
      setError("Network error — please try again.")
      setBusy(false)
    }
  }

  // Heading + subhead shown above the box, per step.
  const copy = stepCopy(mode, step)

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <ShaderBackground fixed calm />
      <LiquidGlassFilters />

      <div className="relative z-10 w-full max-w-[460px]">
        {/* brand */}
        <Link
          href="/"
          className="mx-auto mb-9 flex w-fit items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white/90 transition-colors hover:text-white"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-white font-mono text-[13px] font-bold text-black">
            S
          </span>
          Simplicity
        </Link>

        {/* Google auth button on register first step */}
        {isRegister && idx === 0 && !flash && (
          <a
            href="/api/auth/google/start"
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 active:scale-[0.99]"
          >
            <LogIn className="size-4" />
            Sign up with Google
          </a>
        )}

        {/* the spoken affirmation replaces the box briefly between steps */}
        {flash ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <span
              key={flash}
              className="auth-affirm text-3xl font-semibold tracking-tight text-white sm:text-4xl"
            >
              {flash}
            </span>
          </div>
        ) : (
          <>
            {/* text on top */}
            <div key={`${step}-head`} className="anim-fade mb-6 text-center">
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                {isRegister ? "Create your account" : "Welcome back"}
              </span>
              <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[30px]">
                {copy.heading}
              </h1>
              {copy.sub && <p className="mt-2 text-[15px] text-white/50">{copy.sub}</p>}
            </div>

            {/* the glass box in the middle */}
            <div
              key={`${step}-box`}
              className="glass-in liquid-glass liquid-glass-soft glass-panel relative p-6 sm:p-7"
            >
              <StepBody
                step={step}
                isRegister={isRegister}
                name={name}
                setName={setName}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                rules={rules}
                setRules={setRules}
                autoNight={autoNight}
                setAutoNight={setAutoNight}
                autoMorning={autoMorning}
                setAutoMorning={setAutoMorning}
                onEnter={goNext}
              />

              {error && (
                <p className="mt-4 border-l-2 border-red-400/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}

              {/* controls */}
              <div className="mt-6 flex items-center gap-3">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={busy}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                    aria-label="Back"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={goNext}
                  disabled={busy}
                  className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {isLast ? (isRegister ? "Create account" : "Log in") : nextLabel(step)}
                  {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
                </button>
              </div>
            </div>

            {/* progress + link */}
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-1.5">
                {steps.map((s, i) => (
                  <span
                    key={s}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === idx ? "w-5 bg-white/80" : i < idx ? "w-1.5 bg-white/50" : "w-1.5 bg-white/20"
                    }`}
                  />
                ))}
              </div>
              <p className="text-center text-sm text-white/45">
                {isRegister ? "Already have an account? " : "New to Simplicity? "}
                <Link
                  href={isRegister ? "/login" : "/register"}
                  className="font-medium text-white/85 transition-opacity hover:opacity-70"
                >
                  {isRegister ? "Log in" : "Create one"}
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function nextLabel(step: Step): string {
  if (step === "rules") return "Continue"
  if (step === "settings") return "Finish"
  return "Continue"
}

function stepCopy(mode: "login" | "register", step: Step): { heading: string; sub?: string } {
  if (mode === "register") {
    switch (step) {
      case "name":
        return { heading: "First, what's your name?", sub: "It's how Simplicity will greet you." }
      case "email":
        return { heading: "What's your email?", sub: "You'll use it to log back in." }
      case "password":
        return { heading: "Now set a password.", sub: "At least 8 characters." }
      case "rules":
        return {
          heading: "Teach Simplicity your rules.",
          sub: "Optional — how should it always behave for you?",
        }
      case "settings":
        return { heading: "A couple of preferences.", sub: "You can change these anytime." }
    }
  }
  switch (step) {
    case "email":
      return { heading: "Good to see you again.", sub: "What email did you sign up with?" }
    case "password":
      return { heading: "And your password?", sub: "One more step and you're in." }
  }
  return { heading: "" }
}

function StepBody({
  step,
  isRegister,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  rules,
  setRules,
  autoNight,
  setAutoNight,
  autoMorning,
  setAutoMorning,
  onEnter,
}: {
  step: Step
  isRegister: boolean
  name: string
  setName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  rules: string
  setRules: (v: string) => void
  autoNight: boolean
  setAutoNight: (v: boolean) => void
  autoMorning: boolean
  setAutoMorning: (v: boolean) => void
  onEnter: () => void
}) {
  const enterKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onEnter()
    }
  }

  if (step === "name")
    return (
      <Field
        autoFocus
        value={name}
        onChange={setName}
        onKeyDown={enterKey}
        type="text"
        placeholder="Your name"
        autoComplete="name"
      />
    )

  if (step === "email")
    return (
      <Field
        autoFocus
        value={email}
        onChange={setEmail}
        onKeyDown={enterKey}
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
      />
    )

  if (step === "password")
    return (
      <Field
        autoFocus
        value={password}
        onChange={setPassword}
        onKeyDown={enterKey}
        type="password"
        placeholder={isRegister ? "At least 8 characters" : "Your password"}
        autoComplete={isRegister ? "new-password" : "current-password"}
      />
    )

  if (step === "rules")
    return (
      <textarea
        autoFocus
        value={rules}
        onChange={(e) => setRules(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder="e.g. Always answer concisely. I'm a civil engineer — prefer metric units and cite sources."
        className="w-full resize-none rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-[15px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/40"
      />
    )

  // settings
  return (
    <div className="space-y-2.5">
      <Toggle
        icon={<Moon className="size-4 text-amber-200/80" strokeWidth={1.6} />}
        label="Auto Night mode"
        desc="Warm, quieter light in the evenings."
        on={autoNight}
        onToggle={() => setAutoNight(!autoNight)}
      />
      <Toggle
        icon={<Sunrise className="size-4 text-sky-200/80" strokeWidth={1.6} />}
        label="Auto Morning mode"
        desc="Cooler, brighter ambient in the morning."
        on={autoMorning}
        onToggle={() => setAutoMorning(!autoMorning)}
      />
    </div>
  )
}

function Toggle({
  icon,
  label,
  desc,
  on,
  onToggle,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="block text-xs text-white/45">{desc}</span>
      </span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${
          on ? "bg-white" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-black transition-all duration-200 ${
            on ? "left-[1.125rem]" : "left-0.5 bg-white"
          }`}
        />
      </span>
    </button>
  )
}

function Field({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (v: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
      className="w-full rounded-xl border border-white/12 bg-black/20 px-4 py-3.5 text-[16px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/40"
    />
  )
}
