import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nickname: text("nickname"),
  longTermMemoryEnabled: integer("long_term_memory_enabled").notNull().default(1),
  pushEnabled: integer("push_enabled").notNull().default(0),
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at")
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull()
});
