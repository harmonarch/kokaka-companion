import { z } from "zod"

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nickname: z.string().nullable(),
})

export type User = z.infer<typeof userSchema>

export const authTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
})

export type AuthTokens = z.infer<typeof authTokensSchema>

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nickname: z.string().trim().min(1).max(40).optional(),
})

export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

export const refreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
})

export type RefreshRequest = z.infer<typeof refreshRequestSchema>

export const logoutRequestSchema = refreshRequestSchema
export type LogoutRequest = RefreshRequest

export const authResponseSchema = z.object({
  user: userSchema,
  tokens: authTokensSchema,
})

export type AuthResponse = z.infer<typeof authResponseSchema>

export const updateMeRequestSchema = z.object({
  nickname: z.string().trim().min(1).max(40).nullable(),
})

export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>
