import { z } from "zod"
import { chatMessageSchema } from "./chat"

export const memoryTypeSchema = z.enum([
  "event",
  "preference",
  "emotion_snapshot",
])

export type MemoryType = z.infer<typeof memoryTypeSchema>

export const memorySchema = z.object({
  id: z.string(),
  type: memoryTypeSchema,
  content: z.string(),
  created_at: z.number(),
})

export type Memory = z.infer<typeof memorySchema>

export const memoriesResponseSchema = z.object({
  memories: z.array(memorySchema).max(100),
})

export type MemoriesResponse = z.infer<typeof memoriesResponseSchema>

export const memoryContextResponseSchema = z.object({
  messages: z.array(chatMessageSchema).max(6),
})

export type MemoryContextResponse = z.infer<
  typeof memoryContextResponseSchema
>

export const updateMemoryRequestSchema = z.object({
  content: z.string().trim().min(1).max(500),
})

export type UpdateMemoryRequest = z.infer<typeof updateMemoryRequestSchema>
