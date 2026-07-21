import { jsonResponse, preflight, clientIp, tieredRateLimit } from "@/lib/api/http"
import { getCurrentUser } from "@/lib/auth"
import { getLatestHarnessRequest, createHarnessRequest } from "@/lib/db/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS(req: Request) {
  return preflight(req)
}

// Current user's Harness access status + their latest request (if any).
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)
  const latest = await getLatestHarnessRequest(user.id)
  return jsonResponse(
    {
      access: user.harnessAccess,
      isAdmin: user.isAdmin,
      request: latest ? { status: latest.status, createdAt: latest.createdAt } : null,
    },
    { status: 200 },
    req
  )
}

// Submit a request for Harness access.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req)

  const rl = tieredRateLimit(`harness-req:${user.id}:${clientIp(req)}`, {
    burst: 3,
    burstWindowMs: 60_000,
    sustained: 6,
    sustainedWindowMs: 24 * 60 * 60_000,
  })
  if (!rl.ok) return jsonResponse({ error: "Too many requests — try again later." }, { status: 429 }, req)

  if (user.harnessAccess) return jsonResponse({ error: "You already have Harness access." }, { status: 400 }, req)

  let body: { reason?: string; useCase?: string; company?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request." }, { status: 400 }, req)
  }

  const reason = String(body.reason ?? "").trim()
  const useCase = String(body.useCase ?? "").trim()
  const company = body.company ? String(body.company).trim() : null
  if (reason.length < 10) return jsonResponse({ error: "Tell us a bit more about why you want access." }, { status: 400 }, req)
  if (useCase.length < 10) return jsonResponse({ error: "Describe your intended use case." }, { status: 400 }, req)

  // If an unresolved request already exists, don't stack another.
  const latest = await getLatestHarnessRequest(user.id)
  if (latest && latest.status === "pending")
    return jsonResponse({ error: "Your request is already under review." }, { status: 409 }, req)

  const request = await createHarnessRequest(user.id, reason, useCase, company)
  return jsonResponse({ ok: true, request: { status: request.status, createdAt: request.createdAt } }, { status: 201 }, req)
}
