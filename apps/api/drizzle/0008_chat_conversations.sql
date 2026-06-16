CREATE TABLE IF NOT EXISTS chat_agents (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  persona_prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_chat_agents_user
  ON chat_agents(user_id, created_at);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  last_message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
  ON chat_conversations(user_id, updated_at);

CREATE TABLE IF NOT EXISTS chat_conversation_agents (
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (user_id, conversation_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversation_agents_user_conversation
  ON chat_conversation_agents(user_id, conversation_id, position);
