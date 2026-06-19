import { z } from "zod"
import { emotionStateSchema } from "./emotion"
import { chatProfileSchema } from "./profile"
import { relationshipStateSchema } from "./relationship"

export const chatRoleSchema = z.enum(["user", "agent"])
export type ChatRole = z.infer<typeof chatRoleSchema>

export const chatMessageSchema = z.object({
  id: z.string(),
  role: chatRoleSchema,
  agent_id: z.string().optional().nullable(),
  agent_name: z.string().optional().nullable(),
  content: z.string(),
  created_at: z.number(),
  expression_group_id: z.string().optional().nullable(),
  expression_part_index: z.number().int().nonnegative().optional().nullable(),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

export const chatAgentContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  persona_prompt: z.string().trim().max(500).optional(),
})

export type ChatAgentContext = z.infer<typeof chatAgentContextSchema>

export const chatConversationAgentSchema = chatAgentContextSchema.extend({
  avatar_url: chatProfileSchema.shape.avatar_url,
  created_at: z.number(),
  updated_at: z.number(),
})

export type ChatConversationAgent = z.infer<typeof chatConversationAgentSchema>

export const chatConversationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["single", "group"]),
  title: z.string().trim().min(1).max(80),
  agent_ids: z.array(z.string().min(1)).min(1).max(12),
  last_message: z.string().max(500),
  created_at: z.number(),
  updated_at: z.number(),
})

export type ChatConversation = z.infer<typeof chatConversationSchema>

export const chatConversationsResponseSchema = z.object({
  user: chatProfileSchema,
  agents: z.array(chatConversationAgentSchema),
  conversations: z.array(chatConversationSchema),
})

export type ChatConversationsResponse = z.infer<
  typeof chatConversationsResponseSchema
>

export const createSingleChatRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
  avatar_url: chatProfileSchema.shape.avatar_url.optional(),
  persona_prompt: z.string().trim().max(500).optional(),
  copy_persona_prompt: z.boolean().default(false),
})

export type CreateSingleChatRequest = z.infer<
  typeof createSingleChatRequestSchema
>

export const createGroupChatRequestSchema = z.object({
  title: z.string().trim().max(80).optional(),
  agent_ids: z.array(z.string().min(1)).min(2).max(12),
})

export type CreateGroupChatRequest = z.infer<
  typeof createGroupChatRequestSchema
>

export const createChatConversationResponseSchema = z.object({
  conversation: chatConversationSchema,
  agent: chatConversationAgentSchema.optional(),
})

export type CreateChatConversationResponse = z.infer<
  typeof createChatConversationResponseSchema
>

export const clientChatMessageSchema = z.object({
  type: z.literal("message"),
  content: z.string().trim().min(1),
  session_id: z.string().min(1),
  client_message_id: z.string().min(1),
  agents: z.array(chatAgentContextSchema).max(12).optional(),
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
    relationship_state: relationshipStateSchema,
    topics_count: z.number(),
  }),
})

export const agentStatusSchema = z.enum(["received", "listening", "replying"])
export type AgentStatus = z.infer<typeof agentStatusSchema>

export const agentStatusMessageSchema = z.object({
  type: z.literal("agent_status"),
  status: agentStatusSchema,
  client_message_id: z.string().min(1).optional(),
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

export const chatHistoryRequestSchema = z.object({
  before_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  session_id: z.string().min(1).optional(),
})

export type ChatHistoryRequest = z.infer<typeof chatHistoryRequestSchema>
