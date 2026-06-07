CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT,
  birthday TEXT,
  occupation TEXT,
  company TEXT,
  location TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_memories_time ON memories(user_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  message_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_time
  ON conversation_summaries(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_summaries_user_end_time
  ON conversation_summaries(user_id, end_time);
CREATE INDEX IF NOT EXISTS idx_summaries_conversation_time
  ON conversation_summaries(user_id, conversation_id, end_time);
