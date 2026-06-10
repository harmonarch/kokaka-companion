CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time
  ON chat_messages(user_id, conversation_id, created_at);
