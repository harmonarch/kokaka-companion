CREATE TABLE IF NOT EXISTS chat_profiles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, role)
);
