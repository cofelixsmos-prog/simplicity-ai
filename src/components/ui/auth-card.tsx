"use client"

import { useState, type InputHTMLAttributes } from "react"
import { Loader2, ArrowRight } from "lucide-react"

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.")
        return
      }
      try {
        sessionStorage.setItem("sx-just-logged-in", "1")
      } catch {}
      window.location.href = "/chat"
    } catch {
      setError("Network error — please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="anim-rise w-full max-w-[420px]">
        <div className="rounded-2xl border border-border bg-[#0a0a0b] p-8 sm:p-10">
          {/* badge + eyebrow */}
          <div className="mb-8 flex items-center justify-between">
            <span className="flex size-9 items-center justify-center rounded-md border border-white/15 font-mono text-sm font-medium text-white">
              S
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {isRegister ? "Sign up" : "Log in"}
            </span>
          </div>

          {/* heading */}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {isRegister ? "Start building with Simplicity." : "Log in to continue to Simplicity."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {isRegister && (
              <Field label="Name" type="text" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" required />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
            />

            {error && (
              <p className="border-l-2 border-red-500/60 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {isRegister ? "Create account" : "Log in"}
              {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          <div className="my-6 h-px bg-border" />

          <p className="text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account? " : "New to Simplicity? "}
            <a href={isRegister ? "/login" : "/register"} className="font-medium text-foreground transition-opacity hover:opacity-70">
              {isRegister ? "Log in" : "Create an account"}
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-xs tracking-wide text-muted-foreground">Intelligence without complexity.</p>
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="mt-2 w-full border-b border-white/12 bg-transparent pb-2 text-[15px] text-foreground outline-none transition-colors placeholder:text-white/25 focus:border-white/45"
      />
    </label>
  )
}
