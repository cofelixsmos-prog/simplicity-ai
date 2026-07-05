import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

// Symmetric encryption for secrets at rest (currently: the Gmail App Password).
// AES-256-GCM gives us confidentiality + integrity (the auth tag detects
// tampering). The key is derived from a server-side secret so the ciphertext in
// the DB is useless without the environment.
//
// Set APP_ENCRYPTION_KEY in the environment (any long random string). Without
// it we fall back to a fixed dev key and warn loudly — fine for local dev, NOT
// for production, where a leaked DB would otherwise be trivially decryptable.
const FALLBACK = "sx-dev-insecure-key-change-me"
const SECRET = process.env.APP_ENCRYPTION_KEY
if (!SECRET && process.env.NODE_ENV === "production") {
  console.error("[crypto] APP_ENCRYPTION_KEY is not set — stored secrets use an insecure fallback key.")
}

// Fixed salt is acceptable here: the salt only needs to be stable so the same
// secret always derives the same key. The real secret is APP_ENCRYPTION_KEY.
const KEY = scryptSync(SECRET ?? FALLBACK, "simplicity-secret-salt", 32)

const PREFIX = "v1" // format version, so the scheme can evolve later

// Returns "v1:ivHex:tagHex:cipherHex". Empty input encrypts to empty.
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return ""
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", KEY, iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`
}

// Inverse of encryptSecret. Returns null on any malformed / tampered payload.
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null
  const parts = payload.split(":")
  if (parts.length !== 4 || parts[0] !== PREFIX) return null
  try {
    const [, ivHex, tagHex, ctHex] = parts
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivHex, "hex"))
    decipher.setAuthTag(Buffer.from(tagHex, "hex"))
    const pt = Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()])
    return pt.toString("utf8")
  } catch {
    return null
  }
}
