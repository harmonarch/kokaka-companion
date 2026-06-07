import type { Env } from "@/env"

const encoder = new TextEncoder()

function toBase64Url(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

async function digest(input: string) {
  return toBase64Url(
    await crypto.subtle.digest("SHA-256", encoder.encode(input)),
  )
}

export async function hashPassword(password: string, env: Env) {
  const salt = crypto.randomUUID()
  const hash = await digest(`${salt}:${password}:${env.PASSWORD_HASH_SECRET}`)
  return `${salt}.${hash}`
}

export async function verifyPassword(
  password: string,
  stored: string,
  env: Env,
) {
  const [salt, hash] = stored.split(".")
  if (!salt || !hash) return false
  const candidate = await digest(
    `${salt}:${password}:${env.PASSWORD_HASH_SECRET}`,
  )
  return candidate === hash
}

export async function hashOpaqueToken(token: string, env: Env) {
  return digest(`${token}:${env.JWT_SECRET}`)
}
