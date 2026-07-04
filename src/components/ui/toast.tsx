"use client"

import { useEffect, useState } from "react"
import { Check, X, Info } from "lucide-react"

type ToastKind = "default" | "success" | "error"
interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

// Fire a toast from anywhere: toast("Copied"), toast("Saved", "success").
export function toast(message: string, kind: ToastKind = "default") {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("app-toast", { detail: { id: Date.now() + Math.random(), message, kind } })
  )
}

const ICON: Record<ToastKind, typeof Check> = {
  default: Info,
  success: Check,
  error: X,
}

// Mounted once (in the root layout). Renders quiet glass toasts bottom-center.
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ToastItem>).detail
      setItems((l) => [...l, t])
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== t.id)), 2600)
    }
    window.addEventListener("app-toast", on)
    return () => window.removeEventListener("app-toast", on)
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => {
        const Icon = ICON[t.kind]
        return (
          <div
            key={t.id}
            className="liquid-glass glass-in flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]"
          >
            <Icon
              className={`size-3.5 ${
                t.kind === "success" ? "text-emerald-400" : t.kind === "error" ? "text-red-400" : "text-white/60"
              }`}
            />
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
