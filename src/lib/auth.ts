import { scrypt, randomBytes, timingSafeEqual } from "crypto"
import { promisify } from "util"
import { cookies } from "next/headers"
import { createSession, deleteSession, getSessionUser } from "@/lib/db/repo"

const scryptAsync = promisify(scrypt)
const SESSION_COOKIE = "sid"
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export interface PublicUser {
  id: string
  email: string
  name: string | null
}

// ── Password hashing (scrypt — built into Node, no native deps) ─────────────
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const key = (await scryptAsync(pw, salt, 64)) as Buffer
  return `${salt}:${key.toString("hex")}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(":")
  if (!salt || !keyHex) return false
  const key = Buffer.from(keyHex, "hex")
  const derived = (await scryptAsync(pw, salt, 64)) as Buffer
  return key.length === derived.length && timingSafeEqual(key, derived)
}

// ── Sessions (random token in DB + httpOnly cookie) ─────────────────────────
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex")
  await createSession(token, userId, Date.now() + SESSION_TTL_MS)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
}

export async function endSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) await deleteSession(token)
  store.delete(SESSION_COOKIE)
}

// The authenticated user (or null), with the password hash stripped.
export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const user = await getSessionUser(token)
  return user ? { id: user.id, email: user.email, name: user.name } : null
}
