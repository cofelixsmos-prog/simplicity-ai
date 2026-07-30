"use client"

import { useState } from "react"
import { Check, X, ShieldCheck, Play, Loader2, Mail, FolderOpen, Clock, ChevronRight } from "lucide-react"

// The interactive automation review card shown inline in chat (same design
// language as the plan / questions blocks). Two stages: review the workflow,
// then approve the exact permissions. On accept it creates (or updates) the
// automation via the API — no further AI round-trip needed. Deny hands back to
// the chat so the assistant can ask clarifying questions.
export interface AutomationPlan {
  id?: string
  prompt: string
  name: string
  workflow: string[]
  services: string[]
  permissions: Record<string, Record<string, boolean>>
  config: { approvalMode: boolean; rateLimitPerHour: number; digestHour: number | null }
}

const ACTIONS: Record<string, { key: string; label: string }[]> = {
  gmail: [
    { key: "read", label: "Read emails" },
    { key: "reply", label: "Send replies" },
    { key: "archive", label: "Archive / label" },
    { key: "trash", label: "Delete emails" },
  ],
  drive: [
    { key: "read", label: "Read files" },
    { key: "save", label: "Create / save files" },
  ],
}
const SERVICE_META: Record<string, { label: string; icon: typeof Mail }> = {
  gmail: { label: "Gmail", icon: Mail },
  drive: { label: "Google Drive", icon: FolderOpen },
}

export function WorkflowBlock({
  plan,
  decided = null,
  onDeny,
  onCreated,
}: {
  plan: AutomationPlan
  decided?: "created" | "denied" | null
  onDeny?: () => void
  onCreated?: (name: string, updated: boolean) => void
}) {
  const [stage, setStage] = useState<"workflow" | "permissions">("workflow")
  const [perms, setPerms] = useState(() => structuredClone(plan.permissions))
  const [approval, setApproval] = useState(plan.config.approvalMode)
  const [busy, setBusy] = useState(false)
  const isUpdate = !!plan.id

  const toggle = (svc: string, key: string) =>
    setPerms((p) => ({ ...p, [svc]: { ...p[svc], [key]: !p[svc]?.[key] } }))

  const accept = async () => {
    setBusy(true)
    try {
      if (isUpdate) {
        await fetch(`/api/automations/${plan.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: perms, config: { ...plan.config, approvalMode: approval }, status: "running" }),
        })
      } else {
        await fetch("/api/automations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: plan.prompt,
            activate: true,
            plan: { name: plan.name, workflow: plan.workflow, services: plan.services, permissions: perms, config: { ...plan.config, approvalMode: approval } },
          }),
        })
      }
      onCreated?.(plan.name, isUpdate)
    } finally {
      setBusy(false)
    }
  }

  // Final resolved state.
  if (decided) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm">
        {decided === "created" ? (
          <span className="flex items-center gap-2 text-emerald-400"><Check className="size-4" /> “{plan.name}” is {isUpdate ? "updated and" : ""} running 24/7.</span>
        ) : (
          <span className="flex items-center gap-2 text-white/40"><X className="size-4" /> Dismissed.</span>
        )}
      </div>
    )
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-white/10 text-[11px] font-semibold">
            {plan.services.includes("drive") && !plan.services.includes("gmail") ? <FolderOpen className="size-3.5" /> : <Mail className="size-3.5" />}
          </span>
          <p className="text-sm font-semibold text-white">{plan.name}</p>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">{isUpdate ? "update" : "24/7 automation"}</span>
        </div>
        <span className="text-[11px] text-white/35">{stage === "workflow" ? "Step 1 · Review" : "Step 2 · Permissions"}</span>
      </div>

      {stage === "workflow" ? (
        <>
          <ol className="space-y-2.5 px-5 py-4">
            {plan.workflow.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-white/85">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[11px] font-medium text-white/70">{i + 1}</span>
                <span className="leading-relaxed">{s}</span>
                {i < plan.workflow.length - 1 && <ChevronRight className="ml-auto size-3.5 text-white/15" />}
              </li>
            ))}
          </ol>
          {plan.config.digestHour != null && (
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12.5px] text-white/60">
              <Clock className="size-3.5 text-white/45" /> Runs daily around {plan.config.digestHour}:00.
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-white/8 px-5 py-3">
            <button onClick={() => setStage("permissions")} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-all hover:scale-[1.02]">
              <Check className="size-3.5" /> Looks good
            </button>
            <button onClick={onDeny} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white">
              <X className="size-3.5" /> Change it
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="px-5 py-4">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40"><ShieldCheck className="size-3.5" /> Only the permissions it needs</p>
            {plan.services.map((svc) => {
              const meta = SERVICE_META[svc]; if (!meta) return null
              const Icon = meta.icon
              return (
                <div key={svc} className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-white/60" />{meta.label}</p>
                  <div className="flex flex-col gap-0.5">
                    {ACTIONS[svc]?.map(({ key, label }) => {
                      const on = !!perms[svc]?.[key]
                      const req = !!plan.permissions[svc]?.[key]
                      return (
                        <button key={key} onClick={() => toggle(svc, key)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]">
                          <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300" : "border-white/20 text-transparent"}`}><Check className="size-3" /></span>
                          <span className="flex-1 text-[13px] text-white/80">{label}</span>
                          <span className={`text-[10px] uppercase tracking-wider ${req ? "text-emerald-400/70" : "text-white/30"}`}>{req ? "Required" : "Optional"}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <button onClick={() => setApproval((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left">
              <span>
                <span className="block text-[13px] text-white/80">Approval mode</span>
                <span className="block text-[11px] text-white/40">Hold actions for your OK before they run.</span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${approval ? "bg-emerald-400/80" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${approval ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2 border-t border-white/8 px-5 py-3">
            <button onClick={accept} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-all hover:scale-[1.02] disabled:opacity-40">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} {isUpdate ? "Update & run" : "Accept & run 24/7"}
            </button>
            <button onClick={() => setStage("workflow")} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white">
              Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}
