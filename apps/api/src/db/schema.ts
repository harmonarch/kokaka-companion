import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nickname: text("nickname"),
  longTermMemoryEnabled: integer("long_term_memory_enabled")
    .notNull()
    .default(1),
  pushEnabled: integer("push_enabled").notNull().default(0),
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
})

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
})

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name"),
  birthday: text("birthday"),
  occupation: text("occupation"),
  company: text("company"),
  location: text("location"),
  updatedAt: integer("updated_at").notNull(),
})

export const chatProfiles = sqliteTable(
  "chat_profiles",
  {
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    nickname: text("nickname"),
    avatarUrl: text("avatar_url"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.role] }),
  }),
)

export const chatAgents = sqliteTable(
  "chat_agents",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    personaPrompt: text("persona_prompt").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.id] }),
    userIdx: index("idx_chat_agents_user").on(table.userId, table.createdAt),
  }),
)

export const chatConversations = sqliteTable(
  "chat_conversations",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    lastMessage: text("last_message").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.id] }),
    userUpdatedIdx: index("idx_chat_conversations_user_updated").on(
      table.userId,
      table.updatedAt,
    ),
  }),
)

export const chatConversationAgents = sqliteTable(
  "chat_conversation_agents",
  {
    userId: text("user_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    agentId: text("agent_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.conversationId, table.agentId],
    }),
    userConversationIdx: index(
      "idx_chat_conversation_agents_user_conversation",
    ).on(table.userId, table.conversationId, table.position),
  }),
)

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    conversationId: text("conversation_id"),
    type: text("type").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
    validFrom: integer("valid_from"),
    validTo: integer("valid_to"),
  },
  (table) => ({
    userIdx: index("idx_memories_user").on(table.userId),
    typeIdx: index("idx_memories_type").on(table.userId, table.type),
    timeIdx: index("idx_memories_time").on(table.userId, table.createdAt),
    validityIdx: index("idx_memories_validity").on(
      table.userId,
      table.validFrom,
      table.validTo,
    ),
  }),
)

export const conversationSummaries = sqliteTable(
  "conversation_summaries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    summary: text("summary").notNull(),
    startTime: integer("start_time").notNull(),
    endTime: integer("end_time").notNull(),
    messageCount: integer("message_count").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    timeIdx: index("idx_summaries_time").on(
      table.userId,
      table.startTime,
      table.endTime,
    ),
    userEndTimeIdx: index("idx_summaries_user_end_time").on(
      table.userId,
      table.endTime,
    ),
    conversationTimeIdx: index("idx_summaries_conversation_time").on(
      table.userId,
      table.conversationId,
      table.endTime,
    ),
  }),
)

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    agentId: text("agent_id"),
    agentName: text("agent_name"),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
    expressionGroupId: text("expression_group_id"),
    expressionPartIndex: integer("expression_part_index"),
  },
  (table) => ({
    userTimeIdx: index("idx_chat_messages_user_time").on(
      table.userId,
      table.createdAt,
    ),
    conversationTimeIdx: index("idx_chat_messages_conversation_time").on(
      table.userId,
      table.conversationId,
      table.createdAt,
    ),
  }),
)

export const relationshipStates = sqliteTable("relationship_states", {
  userId: text("user_id").primaryKey(),
  mood: text("mood").notNull(),
  moodIntensity: integer("mood_intensity").notNull(),
  intimacy: integer("intimacy").notNull(),
  lastTransitionAt: integer("last_transition_at").notNull(),
  cooldownUntil: integer("cooldown_until").notNull(),
  updatedAt: integer("updated_at").notNull(),
})
