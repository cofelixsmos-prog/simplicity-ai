"use client"

import { useState, type InputHTMLAttributes, type CSSProperties } from "react"
import { Loader2 } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"

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
      window.location.href = "/chat"
    } catch {
      setError("Network error — please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4">
      <ShaderBackground fixed />
      <LiquidGlassFilters />

      <div className="anim-rise relative z-10 w-full max-w-sm" style={{ ["--delay" as string]: "40ms" } as CSSProperties}>
        <div className="liquid-glass rounded-3xl p-7 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)]">
          <a href="/" className="mb-6 inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
            <span className="size-1.5 rounded-full bg-white/80" />
            Simplicity
          </a>

          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-white/55">
            {isRegister ? "Start building with Simplicity." : "Log in to continue."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {isRegister && (
              <Field label="Name" type="text" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" required />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={isRegister ? "At least 8 characters" : "••••••••"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
            />

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-all hover:bg-white/90 hover:shadow-[0_0_28px_-6px_rgba(255,255,255,0.5)] disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {isRegister ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-white/50">
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <a href={isRegister ? "/login" : "/register"} className="text-white underline underline-offset-2 transition-colors hover:text-white/80">
              {isRegister ? "Log in" : "Sign up"}
            </a>
          </p>
        </div>
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
      <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/35"
      />
    </label>
  )
}
