import type { ChatMessage } from "@ai-companion/shared"
import type { Env } from "@/env"

export async function ensureChatMessagesTable(env: Env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expression_group_id TEXT,
        expression_part_index INTEGER
      )`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time
        ON chat_messages(user_id, created_at)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time
        ON chat_messages(user_id, conversation_id, created_at)`,
    ),
  ])
  await addColumnIfMissing(env, "chat_messages", "agent_id", "TEXT")
  await addColumnIfMissing(env, "chat_messages", "agent_name", "TEXT")
  await addColumnIfMissing(env, "chat_messages", "expression_group_id", "TEXT")
  await addColumnIfMissing(
    env,
    "chat_messages",
    "expression_part_index",
    "INTEGER",
  )
}

async function addColumnIfMissing(
  env: Env,
  table: string,
  column: string,
  definition: string,
) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{
    name: string
  }>()
  const columns = result.results ?? []
  if (columns.some((entry) => entry.name === column)) return
  await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
}

export async function saveChatMessages(
  env: Env,
  input: {
    userId: string
    conversationId: string
    messages: ChatMessage[]
  },
) {
  await ensureChatMessagesTable(env)
  await env.DB.batch(
    input.messages.map((message) =>
      createInsertChatMessageStatement(env, input, message),
    ),
  )
}

export async function replaceChatMessages(
  env: Env,
  input: {
    userId: string
    conversationId: string
    deleteIds: string[]
    messages: ChatMessage[]
  },
) {
  await ensureChatMessagesTable(env)
  await env.DB.batch([
    ...input.deleteIds.map((id) =>
      env.DB.prepare(
        "DELETE FROM chat_messages WHERE user_id = ? AND id = ?",
      ).bind(input.userId, id),
    ),
    ...input.messages.map((message) =>
      createInsertChatMessageStatement(env, input, message),
    ),
  ])
}

export async function chatMessageExists(
  env: Env,
  input: {
    userId: string
    messageId: string
  },
) {
  await ensureChatMessagesTable(env)
  const row = await env.DB.prepare(
    "SELECT id FROM chat_messages WHERE user_id = ? AND id = ? LIMIT 1",
  )
    .bind(input.userId, input.messageId)
    .first<{ id: string }>()
  return Boolean(row)
}

function createInsertChatMessageStatement(
  env: Env,
  input: {
    userId: string
    conversationId: string
  },
  message: ChatMessage,
) {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO chat_messages
      (
        id,
        user_id,
        conversation_id,
        role,
        agent_id,
        agent_name,
        content,
        created_at,
        expression_group_id,
        expression_part_index
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    message.id,
    input.userId,
    input.conversationId,
    message.role,
    message.agent_id ?? null,
    message.agent_name ?? null,
    message.content,
    message.created_at,
    message.expression_group_id ?? null,
    message.expression_part_index ?? null,
  )
}
