ALTER TABLE memories ADD COLUMN valid_from INTEGER;
ALTER TABLE memories ADD COLUMN valid_to INTEGER;

CREATE INDEX IF NOT EXISTS idx_memories_validity
  ON memories(user_id, valid_from, valid_to);
