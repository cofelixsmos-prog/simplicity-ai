// User-tunable preferences captured at sign-up and stored on the account.
// Kept deliberately small and JSON-serializable so it rides along as a single
// TEXT column on the users table (see schema) and mirrors cleanly into
// localStorage for the client-only ambient components to read.

export interface UserSettings {
  autoNight: boolean
  autoMorning: boolean
  // Inactivity dimming (seconds before dimming). 0 = off.
  dimDelay: number
  // Dim opacity (0–1, higher = darker).
  dimOpacity: number
  // Focus mode dim opacity override (typically deeper than normal).
  focusDimOpacity: number
  // Shader animation speed multiplier (0 = frozen, 1 = default).
  animSpeed: number
  // Focus mode animation speed multiplier.
  focusAnimSpeed: number
}

export const DEFAULT_SETTINGS: UserSettings = {
  autoNight: true,
  autoMorning: true,
  dimDelay: 15,
  dimOpacity: 0.4,
  focusDimOpacity: 0.62,
  animSpeed: 1,
  focusAnimSpeed: 0.2,
}

// Parse the stored JSON string defensively — anything missing/invalid falls
// back to the default (opt-out semantics: only an explicit `false` turns off).
export function parseSettings(raw: string | null | undefined): UserSettings {
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const o = JSON.parse(raw) as Partial<UserSettings>
    return {
      autoNight: o.autoNight !== false,
      autoMorning: o.autoMorning !== false,
      dimDelay: typeof o.dimDelay === "number" ? o.dimDelay : DEFAULT_SETTINGS.dimDelay,
      dimOpacity: typeof o.dimOpacity === "number" ? o.dimOpacity : DEFAULT_SETTINGS.dimOpacity,
      focusDimOpacity: typeof o.focusDimOpacity === "number" ? o.focusDimOpacity : DEFAULT_SETTINGS.focusDimOpacity,
      animSpeed: typeof o.animSpeed === "number" ? o.animSpeed : DEFAULT_SETTINGS.animSpeed,
      focusAnimSpeed: typeof o.focusAnimSpeed === "number" ? o.focusAnimSpeed : DEFAULT_SETTINGS.focusAnimSpeed,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function serializeSettings(s: UserSettings): string {
  return JSON.stringify(s)
}

// ── localStorage mirror ───────────────────────────────────────────────────────
// The ambient components (NightMode, ShaderBackground) run client-only and read
// these flags synchronously, so the chat page mirrors the account settings here
// once auth resolves.
export const LS_AUTO_NIGHT = "sx-auto-night"
export const LS_AUTO_MORNING = "sx-auto-morning"

// Broadcast so already-mounted ambient components (which read the mirror on
// mount, before auth resolves) can update live without a reload.
export const SETTINGS_EVENT = "sx-settings-changed"

export function mirrorSettingsToLocal(s: UserSettings): void {
  try {
    localStorage.setItem(LS_AUTO_NIGHT, s.autoNight ? "1" : "0")
    localStorage.setItem(LS_AUTO_MORNING, s.autoMorning ? "1" : "0")
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: s }))
  } catch {
    /* storage unavailable */
  }
}

// Read a single mirrored flag (default on when unset/unavailable).
export function readLocalFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "0"
  } catch {
    return true
  }
}

// A custom system prompt is capped so it can't blow the model's context.
export const MAX_SYSTEM_PROMPT = 2000
