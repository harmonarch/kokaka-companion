CREATE TABLE conversation_observations (
  trace_id TEXT PRIMARY KEY NOT NULL,
  primary_trace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  expression_group_id TEXT,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'ok', 'degraded', 'partial', 'failed')),
  degradation_reason TEXT,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  first_response_ms INTEGER,
  total_duration_ms INTEGER,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  model_call_count INTEGER NOT NULL DEFAULT 0,
  chat_stored INTEGER,
  context_stored INTEGER,
  memory_stored INTEGER,
  vector_stored INTEGER
);

CREATE INDEX idx_conversation_observations_user_started
  ON conversation_observations(user_id, started_at);
CREATE INDEX idx_conversation_observations_conversation_started
  ON conversation_observations(conversation_id, started_at);
CREATE INDEX idx_conversation_observations_primary_trace
  ON conversation_observations(primary_trace_id);

CREATE TABLE conversation_observation_events (
  id TEXT PRIMARY KEY NOT NULL,
  trace_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('started', 'ok', 'degraded', 'partial', 'failed')),
  duration_ms INTEGER,
  provider TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  error_code TEXT,
  external_trace_id TEXT,
  occurred_at INTEGER NOT NULL,
  FOREIGN KEY (trace_id) REFERENCES conversation_observations(trace_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_conversation_observation_events_trace_time
  ON conversation_observation_events(trace_id, occurred_at);
