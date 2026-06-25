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

// One assistant message from a model turn (non-streaming shape).
export interface ModelMessage {
  content: string | null
  tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[]
}

// Context handed to tools that need to stream events or call the model
// themselves (e.g. spawn_agents running sub-agents).
export interface ToolCtx {
  emit: (ev: Record<string, unknown>) => void
  complete: (messages: Record<string, unknown>[], tools?: ToolSchema[]) => Promise<ModelMessage>
}

interface AgentTool {
  schema: ToolSchema
  label: (args: Record<string, unknown>) => string
  run: (args: Record<string, unknown>, ctx?: ToolCtx) => Promise<ToolResult>
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

// ── Sub-agents: spawn_agents lets the model delegate to a team of workers ────
const SUB_MAX_STEPS = 4

function subagentPrompt(name: string): string {
  return (
    `You are "${name}", a focused sub-agent on a team coordinated by Simplicity. ` +
    `Complete ONLY your assigned task. Use web_search to ground facts when useful. ` +
    `Be concise — return just your findings or result, with no preamble and no questions.`
  )
}

interface SubAgentSpec {
  id: string
  name: string
  task: string
}

async function runSubAgent(spec: SubAgentSpec, ctx: ToolCtx): Promise<string> {
  const { id, name, task } = spec
  ctx.emit({ t: "agent", id, name, task, status: "running" })

  const convo: Record<string, unknown>[] = [
    { role: "system", content: subagentPrompt(name) },
    { role: "user", content: task },
  ]

  try {
    for (let step = 0; step < SUB_MAX_STEPS; step++) {
      const msg = await ctx.complete(convo, SUBAGENT_TOOL_SCHEMAS)
      const calls = msg.tool_calls ?? []

      if (calls.length === 0) {
        const final = String(msg.content ?? "").trim()
        ctx.emit({ t: "agent", id, name, task, status: "done", summary: final.slice(0, 300) })
        return final || "(no output)"
      }

      convo.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls })
      for (const tc of calls) {
        const stepId = tc.id
        const toolName = tc.function?.name ?? ""
        let a: Record<string, unknown> = {}
        try {
          a = JSON.parse(tc.function?.arguments || "{}")
        } catch {
          /* keep empty */
        }
        const tool = SUBAGENT_TOOLS[toolName]
        const label = tool ? tool.label(a) : `Running ${toolName}`
        ctx.emit({ t: "agent_step", agentId: id, id: stepId, tool: toolName, label, status: "running" })
        const r = tool ? await tool.run(a) : { result: `Unknown tool: ${toolName}`, detail: "error" }
        ctx.emit({
          t: "agent_step",
          agentId: id,
          id: stepId,
          tool: toolName,
          label,
          status: r.detail === "error" ? "error" : "done",
          detail: r.detail,
        })
        convo.push({ role: "tool", tool_call_id: stepId, content: r.result })
      }
    }
    ctx.emit({ t: "agent", id, name, task, status: "done", summary: "(reached step limit)" })
    return "(reached step limit without a final answer)"
  } catch {
    ctx.emit({ t: "agent", id, name, task, status: "error" })
    return `${name} hit an error.`
  }
}

async function spawnAgents(args: Record<string, unknown>, ctx?: ToolCtx): Promise<ToolResult> {
  const raw = Array.isArray(args.agents) ? (args.agents as Record<string, unknown>[]) : []
  const specs: SubAgentSpec[] = raw
    .slice(0, 4)
    .map((s, i) => ({
      id: randomUUID(),
      name: String(s?.name ?? `Agent ${i + 1}`).slice(0, 40),
      task: String(s?.task ?? "").trim(),
    }))
    .filter((s) => s.task)

  if (!ctx) return { result: "Sub-agents are unavailable in this context.", detail: "error" }
  if (specs.length === 0) return { result: "No valid sub-agent tasks were provided.", detail: "0 agents" }

  // Run the whole team in parallel; each streams its own progress to the UI.
  const results = await Promise.all(specs.map((s) => runSubAgent(s, ctx)))
  const combined = specs
    .map((s, i) => `### ${s.name}\nTask: ${s.task}\nResult:\n${results[i]}`)
    .join("\n\n")

  return {
    result:
      `All ${specs.length} sub-agents have finished. Synthesize their findings into one clear, ` +
      `well-organized answer for the user:\n\n${combined}`,
    detail: `${specs.length} agents`,
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
  spawn_agents: {
    schema: {
      type: "function",
      function: {
        name: "spawn_agents",
        description:
          "Delegate a BIG, multi-part task to a team of focused sub-agents that run in parallel. " +
          "YOU decide how many to spawn (1–4), name each one, and give each a clear, self-contained task. " +
          "Use this for research with several distinct angles, or work that splits into independent parts. " +
          "Each sub-agent can search the web. After they finish you will receive their results to synthesize.",
        parameters: {
          type: "object",
          properties: {
            agents: {
              type: "array",
              description: "The sub-agents to spawn (1–4).",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "A short name for this sub-agent, e.g. \"Market Researcher\"." },
                  task: { type: "string", description: "The specific, self-contained task for this sub-agent." },
                },
                required: ["name", "task"],
              },
            },
          },
          required: ["agents"],
        },
      },
    },
    label: (a) => {
      const n = Array.isArray(a.agents) ? a.agents.length : 0
      return `Spawning ${n} sub-agent${n === 1 ? "" : "s"}`
    },
    run: spawnAgents,
  },
}

export const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => t.schema)

// Tools available to sub-agents — a research subset. Deliberately excludes
// spawn_agents (no recursion) and create_draft (drafts are a parent deliverable).
const SUBAGENT_TOOLS: Record<string, AgentTool> = {
  web_search: TOOLS.web_search,
  get_datetime: TOOLS.get_datetime,
}
const SUBAGENT_TOOL_SCHEMAS = Object.values(SUBAGENT_TOOLS).map((t) => t.schema)
