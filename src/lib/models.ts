// Shared model config used by both the chat UI and the API route.

export interface ModelOption {
  id: string // our public id (a1 / r1)
  label: string // short label shown in the picker
  name: string // full display name
  description: string
  groqModel: string // actual Groq model id
  supportsReasoning: boolean
}

export const MODELS: ModelOption[] = [
  {
    id: "a1",
    label: "A1",
    name: "Simplicity A1",
    description: "Fast, everyday intelligence",
    groqModel: "llama-3.3-70b-versatile",
    supportsReasoning: false,
  },
  {
    id: "r1",
    label: "R1",
    name: "Simplicity R1",
    description: "Frontier reasoning model",
    groqModel: "openai/gpt-oss-120b",
    supportsReasoning: true,
  },
]

export const DEFAULT_MODEL_ID = "r1"

export function getModel(id: string | undefined): ModelOption {
  return (
    MODELS.find((m) => m.id === id) ??
    MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!
  )
}

export type ReasoningEffort = "low" | "medium" | "high"
