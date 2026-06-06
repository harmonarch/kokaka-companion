import { z } from "zod";

export const emotionStateSchema = z.enum([
  "normal",
  "vulnerable",
  "crisis",
  "positive"
]);

export type EmotionState = z.infer<typeof emotionStateSchema>;
