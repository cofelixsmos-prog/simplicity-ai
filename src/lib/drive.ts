// Server-only Google Drive access, using the same OAuth refresh token as Gmail.
// Search/read the user's existing files and create new ones. Access tokens are
// minted from the stored refresh token (cached in google-oauth).
import { randomBytes } from "crypto"
import { decryptSecret } from "@/lib/crypto"
import { googleConfig, getAccessToken } from "@/lib/google-oauth"
import type { User } from "@/lib/db/schema"

const API = "https://www.googleapis.com/drive/v3"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3"

// A "reconnect needed" sentinel: the token is valid but lacks Drive scope
// (e.g. the user connected Google before Drive support was added).
export const RECONNECT = "RECONNECT" as const

async function accessToken(user: User): Promise<string | null> {
  const refresh = decryptSecret(user.gmailRefreshToken)
  const cfg = googleConfig()
  if (!refresh || !cfg) return null
  return getAccessToken(cfg, refresh)
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  link: string
  modified?: string
}

// Friendly labels for Google's internal mime types.
export function kindOf(mimeType: string): string {
  const map: Record<string, string> = {
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/vnd.google-apps.folder": "Folder",
    "application/pdf": "PDF",
  }
  return map[mimeType] ?? mimeType.split("/").pop() ?? mimeType
}

// Search (or list) the user's Drive. `query` does a name + full-text match; empty
// lists the most recently modified files.
export async function searchDrive(
  user: User,
  query: string | undefined,
  limit: number
): Promise<{ files: DriveFile[] } | { error: string }> {
  const token = await accessToken(user)
  if (!token) return { error: "Google isn't connected." }

  const parts = ["trashed = false"]
  if (query?.trim()) {
    const q = query.trim().replace(/'/g, "\\'")
    parts.push(`(name contains '${q}' or fullText contains '${q}')`)
  }
  const url =
    `${API}/files?q=${encodeURIComponent(parts.join(" and "))}` +
    `&pageSize=${limit}&orderBy=modifiedTime desc` +
    `&fields=${encodeURIComponent("files(id,name,mimeType,modifiedTime,webViewLink)")}`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 403) return { error: RECONNECT }
  if (!res.ok) return { error: `Drive search failed (HTTP ${res.status}).` }
  const data = (await res.json()) as {
    files?: { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string }[]
  }
  return {
    files: (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      link: f.webViewLink ?? "",
      modified: f.modifiedTime,
    })),
  }
}

// Google-native docs export to a text-ish format; everything else downloads.
const EXPORT: Record<string, { mime: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv" },
  "application/vnd.google-apps.presentation": { mime: "text/plain" },
}

// Read a file's text content (Docs/Sheets/Slides are exported; text/markdown/csv/
// json download directly). Binary types aren't returned — just a note + link.
export async function readDriveFile(
  user: User,
  fileId: string
): Promise<{ name: string; text: string } | { error: string }> {
  const token = await accessToken(user)
  if (!token) return { error: "Google isn't connected." }

  const metaRes = await fetch(
    `${API}/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent("id,name,mimeType,webViewLink")}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (metaRes.status === 403) return { error: RECONNECT }
  if (metaRes.status === 404) return { error: "That Drive file wasn't found." }
  if (!metaRes.ok) return { error: `Couldn't open the file (HTTP ${metaRes.status}).` }
  const meta = (await metaRes.json()) as { name: string; mimeType: string; webViewLink?: string }

  const exp = EXPORT[meta.mimeType]
  const isText = /^text\/|application\/(json|xml|csv|markdown)/.test(meta.mimeType)
  if (!exp && !isText) {
    return { error: `“${meta.name}” is a ${kindOf(meta.mimeType)} — I can't read its text here. Open it: ${meta.webViewLink ?? ""}` }
  }

  const url = exp
    ? `${API}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exp.mime)}`
    : `${API}/files/${encodeURIComponent(fileId)}?alt=media`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return { error: `Couldn't read “${meta.name}” (HTTP ${res.status}).` }
  const text = (await res.text()).slice(0, 40_000) // keep the model's context sane
  return { name: meta.name, text }
}

// Create a new file in the user's Drive (multipart upload). Defaults to a
// Markdown text file — handy for saving drafts/reports.
export async function createDriveFile(
  user: User,
  name: string,
  content: string,
  mimeType = "text/markdown"
): Promise<{ id: string; name: string; link: string } | { error: string }> {
  const token = await accessToken(user)
  if (!token) return { error: "Google isn't connected." }

  const boundary = "sx" + randomBytes(12).toString("hex")
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name }) +
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n` +
    content +
    `\r\n--${boundary}--`

  const res = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=${encodeURIComponent("id,name,webViewLink")}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (res.status === 403) return { error: RECONNECT }
  if (!res.ok) return { error: `Couldn't save to Drive (HTTP ${res.status}).` }
  const data = (await res.json()) as { id: string; name: string; webViewLink?: string }
  return { id: data.id, name: data.name, link: data.webViewLink ?? "" }
}
