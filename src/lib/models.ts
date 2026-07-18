export interface ModelOption {
  id: string
  label: string
  name: string
  description: string
  supportsReasoning: boolean
}

export const MODELS: ModelOption[] = [
  {
    id: "r1",
    label: "R1",
    name: "Simplicity R1",
    description: "Fast, capable, always on",
    supportsReasoning: false,
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
