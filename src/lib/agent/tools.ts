// Server-only agent tools. Each tool exposes an OpenAI-compatible function
// schema (sent to the model) and a `run` that returns text fed back into the
// loop, plus a short human label/detail for the UI's agent-activity panel.
//
// This file is imported only by the chat API route (server), so any API keys
// it reads never reach the client bundle.

export interface ToolSchema {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolResult {
  result: string // text handed back to the model
  detail?: string // short UI detail, e.g. "5 results"
}

interface AgentTool {
  schema: ToolSchema
  label: (args: Record<string, unknown>) => string
  run: (args: Record<string, unknown>) => Promise<ToolResult>
}

// ── web_search: Google Programmable Search (JSON API) ────────────────────────
async function webSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = String(args.query ?? "").trim()
  if (!query) return { result: "No query was provided.", detail: "no query" }

  const key = process.env.GOOGLE_SEARCH_API_KEY
  const cx = process.env.GOOGLE_SEARCH_CX
  if (!key || !cx) {
    return {
      result:
        "Live web search is not configured on this server (missing GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_CX). " +
        "Answer from your own knowledge and tell the user that live grounding is currently unavailable.",
      detail: "not configured",
    }
  }

  const url =
    `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}&num=5&q=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url)
    if (!res.ok) return { result: `Search failed (HTTP ${res.status}).`, detail: "error" }
    const data = (await res.json()) as { items?: { title?: string; link?: string; snippet?: string }[] }
    const items = data.items ?? []
    if (items.length === 0) return { result: `No results found for "${query}".`, detail: "0 results" }

    const lines = items
      .slice(0, 5)
      .map((it, i) => `${i + 1}. ${it.title ?? "(untitled)"}\n   ${it.link ?? ""}\n   ${it.snippet ?? ""}`)
    return {
      result:
        `Top web results for "${query}":\n\n${lines.join("\n\n")}\n\n` +
        "Use these to ground your answer and cite the relevant links.",
      detail: `${items.length} results`,
    }
  } catch {
    return { result: "The search request failed to reach Google.", detail: "error" }
  }
}

// ── get_datetime: zero-config, proves the loop end-to-end ────────────────────
async function getDatetime(): Promise<ToolResult> {
  const now = new Date()
  return {
    result: `The current date and time is ${now.toISOString()} (UTC).`,
    detail: now.toUTCString().replace("GMT", "UTC"),
  }
}

export const TOOLS: Record<string, AgentTool> = {
  web_search: {
    schema: {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the live web via Google for current, factual, or time-sensitive information. " +
          "Use it whenever the answer depends on recent events, prices, news, specs, or anything you are unsure of.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to send to Google." },
          },
          required: ["query"],
        },
      },
    },
    label: (a) => `Searching Google for “${String(a.query ?? "").slice(0, 80)}”`,
    run: webSearch,
  },
  get_datetime: {
    schema: {
      type: "function",
      function: {
        name: "get_datetime",
        description:
          'Get the current date and time. Use when the user asks about "today", "now", or anything time-relative.',
        parameters: { type: "object", properties: {} },
      },
    },
    label: () => "Checking the current date and time",
    run: getDatetime,
  },
}

export const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => t.schema)
