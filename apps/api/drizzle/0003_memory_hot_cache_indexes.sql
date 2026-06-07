CREATE INDEX IF NOT EXISTS idx_summaries_user_end_time
  ON conversation_summaries(user_id, end_time);

CREATE INDEX IF NOT EXISTS idx_summaries_conversation_time
  ON conversation_summaries(user_id, conversation_id, end_time);
