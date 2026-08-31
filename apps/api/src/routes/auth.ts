import { Hono } from "hono"
import {
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from "@ai-companion/shared"
import { HTTPException } from "hono/http-exception"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"
import { hashOpaqueToken, hashPassword, verifyPassword } from "@/auth/password"
import { createTokenPair, refreshTokenRecord } from "@/auth/tokens"
import { findUserById } from "@/auth/session"

export const authRoutes = new Hono<AppBindings>()

function publicUser(row: {
  id: string
  email: string
  nickname: string | null
}) {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
  }
}

async function saveRefreshToken(
  env: AppBindings["Bindings"],
  userId: string,
  refreshToken: string,
) {
  const record = await refreshTokenRecord(refreshToken, env)
  await env.DB.prepare(
    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      userId,
      record.tokenHash,
      record.expiresAt,
      Math.floor(Date.now() / 1000),
    )
    .run()
}

authRoutes.post("/register", async (c) => {
  const input = registerRequestSchema.parse(await c.req.json())
  const email = input.email.toLowerCase()
  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
  )
    .bind(email)
    .first()
  if (existing) {
    throw new HTTPException(409, { message: "Email already registered" })
  }

  const now = Math.floor(Date.now() / 1000)
  const user = {
    id: crypto.randomUUID(),
    email,
    nickname: input.nickname ?? null,
  }
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      user.id,
      user.email,
      await hashPassword(input.password_hash, c.env),
      user.nickname,
      now,
      now,
    )
    .run()

  const tokens = await createTokenPair(user.id, c.env)
  await saveRefreshToken(c.env, user.id, tokens.refresh_token)
  return c.json({ user, tokens })
})

authRoutes.post("/login", async (c) => {
  const input = loginRequestSchema.parse(await c.req.json())
  const row = await c.env.DB.prepare(
    "SELECT id, email, password_hash, nickname FROM users WHERE email = ? AND deleted_at IS NULL",
  )
    .bind(input.email.toLowerCase())
    .first<{
      id: string
      email: string
      password_hash: string
      nickname: string | null
    }>()
  if (
    !row ||
    !(await verifyPassword(input.password_hash, row.password_hash, c.env))
  ) {
    throw new HTTPException(401, { message: "Invalid email or password" })
  }

  const tokens = await createTokenPair(row.id, c.env)
  await saveRefreshToken(c.env, row.id, tokens.refresh_token)
  return c.json({ user: publicUser(row), tokens })
})

authRoutes.post("/refresh", async (c) => {
  const input = refreshRequestSchema.parse(await c.req.json())
  const tokenHash = await hashOpaqueToken(input.refresh_token, c.env)
  const now = Math.floor(Date.now() / 1000)
  const record = await c.env.DB.prepare(
    "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first<{
      id: string
      user_id: string
      expires_at: number
      revoked_at: number | null
    }>()

  if (record?.revoked_at) {
    // 已轮换的 token 再次使用意味着可能泄露：撤销该用户全部 refresh
    // token，强制所有设备重新登录。
    await c.env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
    )
      .bind(now, record.user_id)
      .run()
  }

  if (!record || record.revoked_at || record.expires_at <= now) {
    throw new HTTPException(401, { message: "Invalid refresh token" })
  }

  const user = await findUserById(c.env, record.user_id)
  if (!user) {
    throw new HTTPException(401, { message: "Invalid refresh token" })
  }

  await c.env.DB.prepare(
    "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?",
  )
    .bind(now, record.id)
    .run()
  const tokens = await createTokenPair(user.id, c.env)
  await saveRefreshToken(c.env, user.id, tokens.refresh_token)
  return c.json({ user, tokens })
})

authRoutes.post("/logout", authMiddleware, async (c) => {
  const input = refreshRequestSchema.parse(await c.req.json())
  const tokenHash = await hashOpaqueToken(input.refresh_token, c.env)
  await c.env.DB.prepare(
    "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
  )
    .bind(Math.floor(Date.now() / 1000), tokenHash)
    .run()
  return c.json({ ok: true })
})
