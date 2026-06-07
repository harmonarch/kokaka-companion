import { z } from "zod"

const nullableDisplayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .nullable()

const nullableAvatarUrlSchema = z
  .string()
  .trim()
  .max(250000)
  .refine(
    (value) =>
      /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value),
    "头像必须是图片",
  )
  .nullable()

export const chatProfileSchema = z.object({
  nickname: nullableDisplayNameSchema,
  avatar_url: nullableAvatarUrlSchema,
})

export type ChatProfile = z.infer<typeof chatProfileSchema>

export const chatProfilesSchema = z.object({
  user: chatProfileSchema,
  agent: chatProfileSchema,
})

export type ChatProfiles = z.infer<typeof chatProfilesSchema>

export const updateChatProfilesRequestSchema = chatProfilesSchema
export type UpdateChatProfilesRequest = z.infer<
  typeof updateChatProfilesRequestSchema
>
