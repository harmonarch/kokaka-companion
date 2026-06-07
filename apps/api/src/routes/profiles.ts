import { Hono } from "hono"
import {
  chatProfilesSchema,
  updateChatProfilesRequestSchema,
  type ChatProfile,
  type ChatProfiles,
} from "@ai-companion/shared"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"

export const profileRoutes = new Hono<AppBindings>()

profileRoutes.use("*", authMiddleware)

type ChatProfileRow = {
  role: "user" | "agent"
  nickname: string | null
  avatar_url: string | null
}

export async function ensureChatProfilesTable(env: AppBindings["Bindings"]) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS chat_profiles (
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      nickname TEXT,
      avatar_url TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, role)
    )`,
  ).run()
}

function emptyProfile(): ChatProfile {
  return {
    nickname: null,
    avatar_url: null,
  }
}

async function getChatProfiles(
  env: AppBindings["Bindings"],
  userId: string,
): Promise<ChatProfiles> {
  await ensureChatProfilesTable(env)
  const rows = await env.DB.prepare(
    "SELECT role, nickname, avatar_url FROM chat_profiles WHERE user_id = ?",
  )
    .bind(userId)
    .all<ChatProfileRow>()

  const profiles = {
    user: emptyProfile(),
    agent: emptyProfile(),
  }

  for (const row of rows.results ?? []) {
    if (row.role !== "user" && row.role !== "agent") continue
    profiles[row.role] = {
      nickname: row.nickname,
      avatar_url: row.avatar_url,
    }
  }

  return chatProfilesSchema.parse(profiles)
}

async function saveChatProfile(
  env: AppBindings["Bindings"],
  userId: string,
  role: "user" | "agent",
  profile: ChatProfile,
  updatedAt: number,
) {
  await env.DB.prepare(
    `INSERT INTO chat_profiles (user_id, role, nickname, avatar_url, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, role) DO UPDATE SET
       nickname = excluded.nickname,
       avatar_url = excluded.avatar_url,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, role, profile.nickname, profile.avatar_url, updatedAt)
    .run()
}

profileRoutes.get("/chat", async (c) => {
  const user = c.get("user")
  return c.json(await getChatProfiles(c.env, user.id))
})

profileRoutes.patch("/chat", async (c) => {
  const input = updateChatProfilesRequestSchema.parse(await c.req.json())
  const user = c.get("user")
  const now = Math.floor(Date.now() / 1000)
  await ensureChatProfilesTable(c.env)
  await Promise.all([
    saveChatProfile(c.env, user.id, "user", input.user, now),
    saveChatProfile(c.env, user.id, "agent", input.agent, now),
  ])
  return c.json(await getChatProfiles(c.env, user.id))
})
