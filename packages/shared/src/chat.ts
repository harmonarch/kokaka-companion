import { z } from "zod"
import { emotionStateSchema } from "./emotion"

export const chatRoleSchema = z.enum(["user", "agent"])
export type ChatRole = z.infer<typeof chatRoleSchema>

export const chatMessageSchema = z.object({
  id: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  created_at: z.number(),
  expression_group_id: z.string().optional().nullable(),
  expression_part_index: z.number().int().nonnegative().optional().nullable(),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

export const clientChatMessageSchema = z.object({
  type: z.literal("message"),
  content: z.string().trim().min(1),
  session_id: z.string().min(1),
  client_message_id: z.string().min(1),
})

export const clientPingMessageSchema = z.object({
  type: z.literal("ping"),
})

export const clientDoneMessageSchema = z.object({
  type: z.literal("done"),
})

export const clientWsMessageSchema = z.discriminatedUnion("type", [
  clientChatMessageSchema,
  clientPingMessageSchema,
  clientDoneMessageSchema,
])

export type ClientWsMessage = z.infer<typeof clientWsMessageSchema>

export const topicStartMessageSchema = z.object({
  type: z.literal("topic_start"),
  topic_id: z.literal("default"),
  label: z.string(),
  index: z.number(),
  total: z.number(),
})

export const tokenMessageSchema = z.object({
  type: z.literal("token"),
  topic_id: z.literal("default"),
  delta: z.string(),
  message_id: z.string().optional(),
  expression_group_id: z.string().optional().nullable(),
  expression_part_index: z.number().int().nonnegative().optional().nullable(),
  expression_part_total: z.number().int().positive().optional(),
})

export const topicDoneMessageSchema = z.object({
  type: z.literal("topic_done"),
  topic_id: z.literal("default"),
})

export const allDoneMessageSchema = z.object({
  type: z.literal("all_done"),
  metadata: z.object({
    emotion_state: emotionStateSchema,
    topics_count: z.number(),
  }),
})

export const agentStatusSchema = z.enum(["received", "listening", "replying"])
export type AgentStatus = z.infer<typeof agentStatusSchema>

export const agentStatusMessageSchema = z.object({
  type: z.literal("agent_status"),
  status: agentStatusSchema,
})

export const pongMessageSchema = z.object({
  type: z.literal("pong"),
})

export const nudgeMessageSchema = z.object({
  type: z.literal("nudge"),
  content: z.string(),
})

export const gentleMessageSchema = z.object({
  type: z.literal("gentle"),
  content: z.string(),
})

export const errorMessageSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
})

export const serverWsMessageSchema = z.discriminatedUnion("type", [
  topicStartMessageSchema,
  tokenMessageSchema,
  topicDoneMessageSchema,
  allDoneMessageSchema,
  agentStatusMessageSchema,
  pongMessageSchema,
  nudgeMessageSchema,
  gentleMessageSchema,
  errorMessageSchema,
])

export type ServerWsMessage = z.infer<typeof serverWsMessageSchema>

export const recentContextSchema = z.object({
  messages: z.array(chatMessageSchema).max(20),
})

export type RecentContext = z.infer<typeof recentContextSchema>

export const chatHistoryResponseSchema = z.object({
  messages: z.array(chatMessageSchema).max(50),
  has_more: z.boolean(),
})

export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>
