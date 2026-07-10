"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Check, Loader2, Mail, HardDrive, Shield, Eye, Sparkles, User, PenLine } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { toast } from "@/components/ui/toast"
import { MAX_SYSTEM_PROMPT, type UserSettings, DEFAULT_SETTINGS } from "@/lib/settings"

interface UserData {
  id: string
  email: string
  name: string | null
  systemPrompt: string | null
  settings: UserSettings
  gmailAddress: string | null
  gmailConnected: boolean
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
        on ? "bg-white" : "bg-white/20"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full shadow transition-transform duration-200 ease-in-out ${
          on ? "translate-x-5 bg-black" : "translate-x-0 bg-white/70"
        }`}
      />
    </button>
  )
}

function Slider({
  value,
  min,
  max,
  step,
  label,
  format,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  label: string
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="min-w-[120px] text-sm text-white/60">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
      />
      <span className="min-w-[48px] text-right font-mono text-xs text-white/50">
        {format ? format(value) : value}
      </span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-white/70">
          {icon}
        </span>
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { window.location.href = "/login"; return }
        setUser(d.user)
        setName(d.user.name || "")
        setSystemPrompt(d.user.systemPrompt || "")
        setSettings(d.user.settings)
      })
      .catch(() => { window.location.href = "/login" })
      .finally(() => setLoading(false))
  }, [])

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (res.ok) toast("Saved", "success")
      else toast("Couldn't save", "error")
    } catch {
      toast("Network error", "error")
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof UserSettings, value: boolean | number) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    save({ settings: { [key]: value } })
  }

  const connectGoogle = () => {
    window.location.href = "/api/gmail/oauth/start"
  }

  const disconnectGoogle = async () => {
    await fetch("/api/gmail", { method: "DELETE" }).catch(() => {})
    setUser((u) => u ? { ...u, gmailConnected: false, gmailAddress: null } : null)
    toast("Google disconnected")
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-white/50" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="relative min-h-dvh">
      <ShaderBackground fixed />
      <LiquidGlassFilters />

      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-20 pt-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <a
            href="/chat"
            className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </a>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
            <p className="text-sm text-white/45">Manage your account and preferences</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Account */}
          <Section title="Account" icon={<User className="size-4" />}>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/40">Email</label>
                <p className="text-sm text-white/70">{user.email}</p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-white/40">Name</label>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  />
                  <button
                    onClick={() => save({ name })}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Google Integration */}
          <Section title="Google Integration" icon={<Shield className="size-4" />}>
            <p className="mb-4 text-xs leading-relaxed text-white/45">
              Connect your Google account to enable Gmail and Google Drive features.
              This is <span className="text-white/70">completely optional</span> — Simplicity works fully without it.
            </p>

            {user.gmailConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
                  <Check className="size-4 text-emerald-300" />
                  <span className="text-sm text-emerald-100/90">
                    Connected{user.gmailAddress ? ` as ${user.gmailAddress}` : ""}
                  </span>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Permissions granted</p>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Mail className="mt-0.5 size-4 shrink-0 text-white/50" />
                      <div>
                        <p className="text-sm font-medium text-white/80">Gmail</p>
                        <p className="text-xs text-white/40">Send emails, read inbox, manage drafts</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <HardDrive className="mt-0.5 size-4 shrink-0 text-white/50" />
                      <div>
                        <p className="text-sm font-medium text-white/80">Google Drive</p>
                        <p className="text-xs text-white/40">Search, read, and save files</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={disconnectGoogle}
                  className="text-xs font-medium text-red-300/70 transition-colors hover:text-red-300"
                >
                  Disconnect Google
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Permissions requested</p>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Mail className="mt-0.5 size-4 shrink-0 text-white/50" />
                      <div>
                        <p className="text-sm font-medium text-white/80">Gmail <span className="text-xs text-white/40">(optional)</span></p>
                        <p className="text-xs text-white/40">Send emails on your behalf, read your inbox, and manage drafts. Simplicity never sends without your explicit approval.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <HardDrive className="mt-0.5 size-4 shrink-0 text-white/50" />
                      <div>
                        <p className="text-sm font-medium text-white/80">Google Drive <span className="text-xs text-white/40">(optional)</span></p>
                        <p className="text-xs text-white/40">Search and read your files, and save new documents. Only accesses files you specifically ask about.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={connectGoogle}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99]"
                >
                  Connect with Google
                </button>
                <p className="text-[11px] text-white/30">
                  You&apos;ll be redirected to Google&apos;s secure sign-in. No passwords are shared with Simplicity.
                </p>
              </div>
            )}
          </Section>

          {/* System Prompt */}
          <Section title="Custom Instructions" icon={<PenLine className="size-4" />}>
            <p className="mb-3 text-xs text-white/45">
              Tell Simplicity how to behave — your preferred tone, role, or any rules to always follow.
              This is injected into every chat.
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value.slice(0, MAX_SYSTEM_PROMPT))}
              placeholder="e.g. Always respond in formal English. You are my study tutor for physics."
              rows={5}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-white/30">
                {systemPrompt.length}/{MAX_SYSTEM_PROMPT}
              </span>
              <button
                onClick={() => save({ systemPrompt })}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Save
              </button>
            </div>
          </Section>

          {/* Dimming */}
          <Section title="Dimming" icon={<Eye className="size-4" />}>
            <div className="space-y-5">
              <Slider
                label="Inactivity delay"
                value={settings.dimDelay}
                min={0}
                max={120}
                step={5}
                format={(v) => v === 0 ? "Off" : `${v}s`}
                onChange={(v) => updateSetting("dimDelay", v)}
              />
              <Slider
                label="Dim intensity"
                value={settings.dimOpacity}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => updateSetting("dimOpacity", v)}
              />
              <Slider
                label="Focus dim intensity"
                value={settings.focusDimOpacity}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => updateSetting("focusDimOpacity", v)}
              />
            </div>
          </Section>

          {/* Animation */}
          <Section title="Animation" icon={<Sparkles className="size-4" />}>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Auto Night mode</p>
                  <p className="text-xs text-white/40">Warm amber tint in the evening</p>
                </div>
                <Toggle on={settings.autoNight} onChange={(v) => updateSetting("autoNight", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Auto Morning mode</p>
                  <p className="text-xs text-white/40">Cool blue tint in the morning</p>
                </div>
                <Toggle on={settings.autoMorning} onChange={(v) => updateSetting("autoMorning", v)} />
              </div>
              <Slider
                label="Animation speed"
                value={settings.animSpeed}
                min={0}
                max={2}
                step={0.1}
                format={(v) => v === 0 ? "Off" : `${v.toFixed(1)}x`}
                onChange={(v) => updateSetting("animSpeed", v)}
              />
              <Slider
                label="Focus anim speed"
                value={settings.focusAnimSpeed}
                min={0}
                max={2}
                step={0.1}
                format={(v) => v === 0 ? "Off" : `${v.toFixed(1)}x`}
                onChange={(v) => updateSetting("focusAnimSpeed", v)}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
