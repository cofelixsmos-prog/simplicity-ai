// Public model metadata, shared by the chat UI and the API route.
// NOTE: the real upstream provider + model id for each entry are intentionally
// NOT here — they live server-side only (in the chat API route) so the real
// model names never ship in the browser bundle.

export interface ModelOption {
  id: string // our public id (a1 / r1 / d1)
  label: string // short label shown in the picker
  name: string // full display name
  description: string
  supportsReasoning: boolean
}

export const MODELS: ModelOption[] = [
  {
    id: "a1",
    label: "A1",
    name: "Simplicity A1",
    description: "Fast, everyday intelligence",
    supportsReasoning: false,
  },
  {
    id: "r1",
    label: "R1",
    name: "Simplicity R1",
    description: "Frontier reasoning model",
    supportsReasoning: true,
  },
  {
    id: "d1",
    label: "D1",
    name: "Simplicity D1",
    description: "Fast and free, always on",
    supportsReasoning: false,
  },
]

export const DEFAULT_MODEL_ID = "d1"

export function getModel(id: string | undefined): ModelOption {
  return (
    MODELS.find((m) => m.id === id) ??
    MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!
  )
}

export type ReasoningEffort = "low" | "medium" | "high"
