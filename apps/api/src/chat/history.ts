import type { ChatMessage } from "@ai-companion/shared";
import type { Env } from "@/env";

export async function ensureChatMessagesTable(env: Env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time
        ON chat_messages(user_id, created_at)`
    )
  ]);
}

export async function saveChatMessages(
  env: Env,
  input: {
    userId: string;
    conversationId: string;
    messages: ChatMessage[];
  }
) {
  await ensureChatMessagesTable(env);
  await env.DB.batch(
    input.messages.map((message) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO chat_messages
          (id, user_id, conversation_id, role, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        message.id,
        input.userId,
        input.conversationId,
        message.role,
        message.content,
        message.created_at
      )
    )
  );
}
