import { z } from "zod"

export const audioTranscriptionResponseSchema = z.object({
  text: z.string().trim().min(1),
})

export type AudioTranscriptionResponse = z.infer<
  typeof audioTranscriptionResponseSchema
>
