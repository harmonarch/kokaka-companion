import type { User } from "@ai-companion/shared"
import type { Env } from "@/env"
import { verifyAccessToken } from "@/auth/tokens"

export type AppUser = User

export async function findUserById(env: Env, id: string) {
  const row = await env.DB.prepare(
    "SELECT id, email, nickname FROM users WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(id)
    .first<User>()
  return row ?? null
}

export async function authenticateRequest(env: Env, request: Request) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null
  if (!token) return null
  const payload = await verifyAccessToken(token, env)
  if (!payload) return null
  return findUserById(env, payload.sub)
}
