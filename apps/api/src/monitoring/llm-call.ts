export type LlmCallStatus = "success" | "fallback" | "error"

export type LlmCallUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type LlmCallObservation = {
  provider: string
  model: string
  operation: string
  durationMs: number
  status: LlmCallStatus
  retries: number
  usage?: LlmCallUsage
  fallbackReason?: string
}

type ProviderUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export function observeLlmCall(
  input: Omit<LlmCallObservation, "usage"> & {
    usage?: ProviderUsage
  },
): LlmCallObservation {
  const observation: LlmCallObservation = {
    provider: input.provider,
    model: input.model,
    operation: input.operation,
    durationMs: input.durationMs,
    status: input.status,
    retries: input.retries,
    ...(input.usage
      ? {
          usage: {
            promptTokens: input.usage.prompt_tokens ?? 0,
            completionTokens: input.usage.completion_tokens ?? 0,
            totalTokens: input.usage.total_tokens ?? 0,
          },
        }
      : {}),
    ...(input.fallbackReason ? { fallbackReason: input.fallbackReason } : {}),
  }

  console.info(JSON.stringify({ event: "llm_call", ...observation }))
  return observation
}
