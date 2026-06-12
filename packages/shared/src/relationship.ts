import { z } from "zod"

export const relationshipMoodSchema = z.enum([
  "calm",
  "happy",
  "angry",
  "sad",
  "shy",
  "jealous",
])

export type RelationshipMood = z.infer<typeof relationshipMoodSchema>

export const intimacyLevelSchema = z.enum([
  "polite",
  "warm",
  "attached",
  "deep",
  "full",
])

export type IntimacyLevel = z.infer<typeof intimacyLevelSchema>

export const relationshipStateSchema = z.object({
  mood: relationshipMoodSchema,
  mood_intensity: z.number().min(0).max(100),
  intimacy: z.number().min(0).max(100),
  intimacy_level: intimacyLevelSchema,
  updated_at: z.number(),
  last_transition_at: z.number(),
  cooldown_until: z.number(),
})

export type RelationshipState = z.infer<typeof relationshipStateSchema>

export const relationshipResponseSchema = z.object({
  relationship_state: relationshipStateSchema,
})

export type RelationshipResponse = z.infer<typeof relationshipResponseSchema>
