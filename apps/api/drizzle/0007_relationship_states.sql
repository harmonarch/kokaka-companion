CREATE TABLE IF NOT EXISTS relationship_states (
  user_id TEXT PRIMARY KEY,
  mood TEXT NOT NULL,
  mood_intensity INTEGER NOT NULL,
  intimacy INTEGER NOT NULL,
  last_transition_at INTEGER NOT NULL,
  cooldown_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
