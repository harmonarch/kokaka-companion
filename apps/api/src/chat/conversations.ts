import type {
  ChatConversation,
  ChatConversationAgent,
  ChatProfile,
} from "@ai-companion/shared"
import type { Env } from "@/env"
import { ensureChatMessagesTable } from "@/chat/history"
import { ensureChatProfilesTable } from "@/routes/profiles"

const defaultAgentId = "agent:xiaolian"
const defaultConversationId = "default"
const defaultAgentPrompt = "温柔地陪我整理情绪"

type AgentRow = {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  persona_prompt: string
  created_at: number
  updated_at: number
}

type ConversationRow = {
  id: string
  user_id: string
  type: "single" | "group"
  title: string
  last_message: string
  created_at: number
  updated_at: number
}

type ConversationAgentRow = {
  conversation_id: string
  agent_id: string
  position: number
}

type LatestMessageRow = {
  conversation_id: string
  content: string
  created_at: number
}

export async function ensureChatConversationsTables(env: Env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS chat_agents (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        persona_prompt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, id)
      )`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_chat_agents_user
        ON chat_agents(user_id, created_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS chat_conversations (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        last_message TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, id)
      )`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
        ON chat_conversations(user_id, updated_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS chat_conversation_agents (
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (user_id, conversation_id, agent_id)
      )`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_chat_conversation_agents_user_conversation
        ON chat_conversation_agents(user_id, conversation_id, position)`,
    ),
  ])
}

export async function ensureDefaultConversation(env: Env, userId: string) {
  await ensureChatProfilesTable(env)
  await ensureChatConversationsTables(env)
  const now = Date.now()
  const profile = await env.DB.prepare(
    "SELECT nickname, avatar_url FROM chat_profiles WHERE user_id = ? AND role = 'agent'",
  )
    .bind(userId)
    .first<ChatProfile>()
  const defaultName = profile?.nickname?.trim() || "小练"

  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO chat_agents
        (id, user_id, name, avatar_url, persona_prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      defaultAgentId,
      userId,
      defaultName,
      profile?.avatar_url ?? null,
      defaultAgentPrompt,
      1,
      now,
    ),
    env.DB.prepare(
      `UPDATE chat_agents
       SET name = ?, avatar_url = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND created_at = 1`,
    ).bind(
      defaultName,
      profile?.avatar_url ?? null,
      now,
      defaultAgentId,
      userId,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO chat_conversations
        (id, user_id, type, title, last_message, created_at, updated_at)
       VALUES (?, ?, 'single', ?, ?, ?, ?)`,
    ).bind(
      defaultConversationId,
      userId,
      defaultName,
      "可以从一句很小的话开始",
      1,
      1,
    ),
    env.DB.prepare(
      `UPDATE chat_conversations
       SET title = ?
       WHERE id = ? AND user_id = ? AND created_at = 1`,
    ).bind(defaultName, defaultConversationId, userId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO chat_conversation_agents
        (user_id, conversation_id, agent_id, position)
       VALUES (?, ?, ?, 0)`,
    ).bind(userId, defaultConversationId, defaultAgentId),
  ])
}

export async function getChatConversationList(env: Env, userId: string) {
  await ensureDefaultConversation(env, userId)
  await ensureChatMessagesTable(env)
  const [
    agentRows,
    conversationRows,
    linkRows,
    latestMessageRows,
    userProfile,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT id, user_id, name, avatar_url, persona_prompt, created_at, updated_at
         FROM chat_agents
         WHERE user_id = ?
         ORDER BY created_at ASC`,
    )
      .bind(userId)
      .all<AgentRow>()
      .then((result) => result.results ?? []),
    env.DB.prepare(
      `SELECT id, user_id, type, title, last_message, created_at, updated_at
         FROM chat_conversations
         WHERE user_id = ?
         ORDER BY updated_at DESC, created_at DESC`,
    )
      .bind(userId)
      .all<ConversationRow>()
      .then((result) => result.results ?? []),
    env.DB.prepare(
      `SELECT conversation_id, agent_id, position
         FROM chat_conversation_agents
         WHERE user_id = ?
         ORDER BY position ASC`,
    )
      .bind(userId)
      .all<ConversationAgentRow>()
      .then((result) => result.results ?? []),
    env.DB.prepare(
      `SELECT conversation_id, content, created_at
         FROM (
           SELECT
             conversation_id,
             content,
             created_at,
             ROW_NUMBER() OVER (
               PARTITION BY conversation_id
               ORDER BY created_at DESC, rowid DESC
             ) AS row_number
           FROM chat_messages
           WHERE user_id = ?
         )
         WHERE row_number = 1`,
    )
      .bind(userId)
      .all<LatestMessageRow>()
      .then((result) => result.results ?? []),
    env.DB.prepare(
      "SELECT nickname, avatar_url FROM chat_profiles WHERE user_id = ? AND role = 'user'",
    )
      .bind(userId)
      .first<ChatProfile>(),
  ])

  const linksByConversationId = new Map<string, string[]>()
  for (const row of linkRows) {
    const links = linksByConversationId.get(row.conversation_id) ?? []
    links.push(row.agent_id)
    linksByConversationId.set(row.conversation_id, links)
  }

  const agents = agentRows.map(toAgent)
  const agentIds = new Set(agents.map((agent) => agent.id))
  const latestMessagesByConversationId = new Map(
    latestMessageRows.map((row) => [row.conversation_id, row]),
  )
  const conversations = conversationRows
    .map((row): ChatConversation | null => {
      const linkedAgentIds = (linksByConversationId.get(row.id) ?? []).filter(
        (agentId) => agentIds.has(agentId),
      )
      if (!linkedAgentIds.length) return null
      const latestMessage = latestMessagesByConversationId.get(row.id)
      return {
        id: row.id,
        type: row.type === "group" ? "group" : "single",
        title: row.title,
        agent_ids: linkedAgentIds,
        last_message: latestMessage?.content ?? row.last_message,
        created_at: row.created_at,
        updated_at:
          latestMessage && latestMessage.created_at > row.updated_at
            ? latestMessage.created_at
            : row.updated_at,
      }
    })
    .filter((conversation): conversation is ChatConversation =>
      Boolean(conversation),
    )
    .sort((a, b) => b.updated_at - a.updated_at)

  return {
    user: {
      nickname: userProfile?.nickname ?? null,
      avatar_url: userProfile?.avatar_url ?? null,
    },
    agents,
    conversations,
  }
}

export async function createSingleChatConversation(
  env: Env,
  input: {
    userId: string
    name: string
    avatarUrl?: string | null
    personaPrompt?: string
    copyPersonaPrompt?: boolean
  },
) {
  await ensureDefaultConversation(env, input.userId)
  const now = Date.now()
  const agentId = createId("agent")
  const conversationId = `chat:${agentId}`
  const personaPrompt = input.copyPersonaPrompt
    ? await getDefaultAgentPersonaPrompt(env, input.userId)
    : (input.personaPrompt?.trim() ?? "")
  const agent: ChatConversationAgent = {
    id: agentId,
    name: input.name.trim(),
    avatar_url: input.avatarUrl?.trim() || null,
    persona_prompt: personaPrompt,
    created_at: now,
    updated_at: now,
  }
  const conversation: ChatConversation = {
    id: conversationId,
    type: "single",
    title: agent.name,
    agent_ids: [agent.id],
    last_message: personaPrompt || "新的 Agent 已添加",
    created_at: now,
    updated_at: now,
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO chat_agents
        (id, user_id, name, avatar_url, persona_prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      agent.id,
      input.userId,
      agent.name,
      agent.avatar_url,
      agent.persona_prompt ?? "",
      agent.created_at,
      agent.updated_at,
    ),
    env.DB.prepare(
      `INSERT INTO chat_conversations
        (id, user_id, type, title, last_message, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      conversation.id,
      input.userId,
      conversation.type,
      conversation.title,
      conversation.last_message,
      conversation.created_at,
      conversation.updated_at,
    ),
    env.DB.prepare(
      `INSERT INTO chat_conversation_agents
        (user_id, conversation_id, agent_id, position)
       VALUES (?, ?, ?, 0)`,
    ).bind(input.userId, conversation.id, agent.id),
  ])

  return {
    conversation,
    agent,
  }
}

export async function createGroupChatConversation(
  env: Env,
  input: {
    userId: string
    title?: string
    agentIds: string[]
  },
) {
  await ensureDefaultConversation(env, input.userId)
  const uniqueAgentIds = Array.from(new Set(input.agentIds))
  const selectedAgents = await getAgentsByIds(env, input.userId, uniqueAgentIds)
  if (selectedAgents.length < 2) {
    throw new Error("至少选择两个 Agent")
  }
  const selectedAgentIds = selectedAgents.map((agent) => agent.id)
  const now = Date.now()
  const title =
    input.title?.trim() ||
    selectedAgents.map((agent) => agent.name).join("、") ||
    "新的群聊"
  const conversation: ChatConversation = {
    id: createId("group"),
    type: "group",
    title,
    agent_ids: selectedAgentIds,
    last_message: "群聊已创建",
    created_at: now,
    updated_at: now,
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO chat_conversations
        (id, user_id, type, title, last_message, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      conversation.id,
      input.userId,
      conversation.type,
      conversation.title,
      conversation.last_message,
      conversation.created_at,
      conversation.updated_at,
    ),
    ...selectedAgentIds.map((agentId, index) =>
      env.DB.prepare(
        `INSERT INTO chat_conversation_agents
          (user_id, conversation_id, agent_id, position)
         VALUES (?, ?, ?, ?)`,
      ).bind(input.userId, conversation.id, agentId, index),
    ),
  ])

  return {
    conversation,
  }
}

export async function deleteChatConversationData(env: Env, userId: string) {
  await ensureChatConversationsTables(env)
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM chat_conversation_agents WHERE user_id = ?",
    ).bind(userId),
    env.DB.prepare("DELETE FROM chat_conversations WHERE user_id = ?").bind(
      userId,
    ),
    env.DB.prepare("DELETE FROM chat_agents WHERE user_id = ?").bind(userId),
  ])
}

async function getDefaultAgentPersonaPrompt(env: Env, userId: string) {
  const row = await env.DB.prepare(
    "SELECT persona_prompt FROM chat_agents WHERE user_id = ? AND id = ?",
  )
    .bind(userId, defaultAgentId)
    .first<{ persona_prompt: string }>()
  return row?.persona_prompt?.trim() || defaultAgentPrompt
}

async function getAgentsByIds(env: Env, userId: string, agentIds: string[]) {
  if (!agentIds.length) return []
  const placeholders = agentIds.map(() => "?").join(", ")
  const rows = await env.DB.prepare(
    `SELECT id, user_id, name, avatar_url, persona_prompt, created_at, updated_at
     FROM chat_agents
     WHERE user_id = ? AND id IN (${placeholders})`,
  )
    .bind(userId, ...agentIds)
    .all<AgentRow>()
    .then((result) => result.results ?? [])
  const rowsById = new Map(rows.map((row) => [row.id, row]))
  return agentIds
    .map((agentId) => rowsById.get(agentId))
    .filter((row): row is AgentRow => Boolean(row))
    .map(toAgent)
}

function toAgent(row: AgentRow): ChatConversationAgent {
  return {
    id: row.id,
    name: row.name,
    avatar_url: row.avatar_url,
    persona_prompt: row.persona_prompt,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function createId(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`
}
