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

      <div
        className="anim-rise relative z-10 w-full max-w-[400px]"
        style={{ ["--delay" as string]: "40ms" } as CSSProperties}
      >
        <div className="liquid-glass rounded-[28px] p-8 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.75)]">
          {/* Brand + heading */}
          <div className="mb-7 flex flex-col items-center text-center">
            <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-bold tracking-tight text-black">
              S
            </span>
            <h1 className="text-[22px] font-semibold tracking-tight text-white">
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm text-white/50">
              {isRegister ? "Start building with Simplicity." : "Log in to continue to Simplicity."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3.5">
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
              <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-black transition-all hover:shadow-[0_0_32px_-6px_rgba(255,255,255,0.6)] active:scale-[0.99] disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {isRegister ? "Create account" : "Log in"}
            </button>
          </form>

          <div className="my-5 h-px bg-white/10" />

          <p className="text-center text-[13px] text-white/50">
            {isRegister ? "Already have an account? " : "New to Simplicity? "}
            <a href={isRegister ? "/login" : "/register"} className="font-medium text-white transition-colors hover:text-white/80">
              {isRegister ? "Log in" : "Create an account"}
            </a>
          </p>
        </div>

        <p className="mt-5 text-center text-[11px] text-white/30">Intelligence without complexity.</p>
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
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-[15px] text-white outline-none transition-all placeholder:text-white/30 focus:border-white/30 focus:bg-white/[0.06]"
      />
    </label>
  )
}
