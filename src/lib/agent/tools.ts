// Server-only agent tools. Each tool exposes an OpenAI-compatible function
// schema (sent to the model) and a `run` that returns text fed back into the
// loop, plus a short human label/detail for the UI's agent-activity panel.
//
// This file is imported only by the chat API route (server), so any API keys
// it reads never reach the client bundle.

import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { db, initDb } from "@/lib/db"
import { drafts } from "@/lib/db/schema"

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
  ui?: Record<string, unknown> // optional event to forward straight to the client UI
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

// ── create_draft / update_draft: write essays/docs to the editable canvas ────
async function createDraft(args: Record<string, unknown>): Promise<ToolResult> {
  const title = (String(args.title ?? "").trim() || "Untitled draft").slice(0, 200)
  const content = String(args.content ?? "").trim()
  if (!content) return { result: "No content was provided for the draft.", detail: "empty" }

  await initDb()
  const id = randomUUID()
  const now = Date.now()
  await db.insert(drafts).values({ id, title, content, createdAt: now, updatedAt: now })

  return {
    result:
      `Draft created: "${title}" (id: ${id}). It is now open in the editor for the user to read and edit. ` +
      `To revise it later, call update_draft with this id.`,
    detail: title,
    ui: { t: "draft", id, title, content },
  }
}

async function updateDraft(args: Record<string, unknown>): Promise<ToolResult> {
  const id = String(args.id ?? "").trim()
  if (!id) return { result: "An existing draft id is required to update.", detail: "no id" }

  await initDb()
  const existing = (await db.select().from(drafts).where(eq(drafts.id, id)))[0]
  if (!existing) return { result: `No draft found with id ${id}.`, detail: "not found" }

  const content = args.content !== undefined ? String(args.content) : existing.content
  const title = args.title !== undefined ? String(args.title).slice(0, 200) : existing.title
  await db.update(drafts).set({ title, content, updatedAt: Date.now() }).where(eq(drafts.id, id))

  return {
    result: `Draft "${title}" (id: ${id}) updated and refreshed in the editor.`,
    detail: title,
    ui: { t: "draft", id, title, content },
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
  create_draft: {
    schema: {
      type: "function",
      function: {
        name: "create_draft",
        description:
          "Write a draft, essay, article, or any long-form document. Call this whenever the user asks you to " +
          "WRITE something substantial (an essay, blog post, cover letter, report copy, story). It opens an " +
          "editable document canvas for the user. Put the full piece in `content` as Markdown.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "A short title for the document." },
            content: { type: "string", description: "The full document body in Markdown." },
          },
          required: ["title", "content"],
        },
      },
    },
    label: (a) => `Writing draft “${String(a.title ?? "Untitled").slice(0, 60)}”`,
    run: createDraft,
  },
  update_draft: {
    schema: {
      type: "function",
      function: {
        name: "update_draft",
        description:
          "Revise an existing draft you previously created. Pass the draft's id and the new full Markdown content.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "The id returned by create_draft." },
            title: { type: "string", description: "Optional new title." },
            content: { type: "string", description: "The full revised document body in Markdown." },
          },
          required: ["id", "content"],
        },
      },
    },
    label: (a) => `Revising draft ${String(a.id ?? "").slice(0, 8)}`,
    run: updateDraft,
  },
}

export const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => t.schema)
