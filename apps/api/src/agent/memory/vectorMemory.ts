import type { Env } from "@/env"
import { observeLlmCall, type LlmCallObservation } from "@/monitoring/llm-call"

const VECTOR_NAMESPACE = "long_term_memory"

function hasVectorize(env: Env) {
  return Boolean(
    env.MEMORY_VECTORIZE &&
    env.EMBEDDING_BASE_URL &&
    env.EMBEDDING_MODEL &&
    env.EMBEDDING_API_KEY,
  )
}

async function createEmbedding(
  env: Env,
  input: string,
  options: {
    operation: string
    onLlmCall?: (call: LlmCallObservation) => void
  },
) {
  const startedAt = Date.now()
  const report = (
    status: LlmCallObservation["status"],
    fallbackReason?: string,
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    },
  ) => {
    const call = observeLlmCall({
      provider: "embedding",
      model: env.EMBEDDING_MODEL ?? "unknown",
      operation: options.operation,
      durationMs: Date.now() - startedAt,
      status,
      retries: 0,
      usage,
      fallbackReason,
    })
    options.onLlmCall?.(call)
  }
  if (!hasVectorize(env)) {
    report("fallback", "provider_not_configured")
    return null
  }
  try {
    const response = await fetch(`${env.EMBEDDING_BASE_URL}/v1/embeddings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.EMBEDDING_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.EMBEDDING_MODEL,
        input,
      }),
    })
    if (!response.ok) {
      report("fallback", `http_${response.status}`)
      return null
    }
    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
      }
    }
    const embedding = data.data?.[0]?.embedding
    if (!embedding?.length) {
      report("fallback", "empty_response", data.usage)
      return null
    }
    report("success", undefined, data.usage)
    return embedding
  } catch {
    report("fallback", "request_error")
    return null
  }
}

function memoryVectorMetadata(input: {
  userId: string
  conversationId: string
  type: string
  content: string
  createdAt: number
  validFrom?: number | null
  validTo?: number | null
}) {
  return {
    userId: input.userId,
    conversationId: input.conversationId,
    type: input.type,
    content: input.content,
    createdAt: input.createdAt,
    ...(typeof input.validFrom === "number"
      ? { validFrom: input.validFrom }
      : {}),
    ...(typeof input.validTo === "number" ? { validTo: input.validTo } : {}),
  }
}

export async function upsertMemoryVector(
  env: Env,
  input: {
    id: string
    userId: string
    conversationId: string
    type: string
    content: string
    createdAt: number
    validFrom?: number | null
    validTo?: number | null
    onLlmCall?: (call: LlmCallObservation) => void
    onVectorResult?: (result: { success: boolean; reason?: string }) => void
  },
) {
  const embedding = await createEmbedding(env, input.content, {
    operation: "memory_embedding_upsert",
    onLlmCall: input.onLlmCall,
  })
  if (!embedding || !env.MEMORY_VECTORIZE) {
    input.onVectorResult?.({
      success: false,
      reason: embedding ? "vectorize_unavailable" : "embedding_unavailable",
    })
    return false
  }
  try {
    await env.MEMORY_VECTORIZE.upsert([
      {
        id: input.id,
        values: embedding,
        namespace: VECTOR_NAMESPACE,
        metadata: memoryVectorMetadata(input),
      },
    ])
    input.onVectorResult?.({ success: true })
    return true
  } catch {
    input.onVectorResult?.({ success: false, reason: "vector_upsert_failed" })
    return false
  }
}

export async function deleteMemoryVector(env: Env, id: string) {
  const index = env.MEMORY_VECTORIZE as
    | (VectorizeIndex & {
        deleteByIds?: (ids: string[]) => Promise<unknown>
      })
    | undefined
  if (!index?.deleteByIds) return false
  await index.deleteByIds([id])
  return true
}

const VECTORIZE_DELETE_BATCH_SIZE = 1000

export async function deleteMemoryVectorsByIds(env: Env, ids: string[]) {
  const index = env.MEMORY_VECTORIZE as
    | (VectorizeIndex & {
        deleteByIds?: (ids: string[]) => Promise<unknown>
      })
    | undefined
  if (!index?.deleteByIds || ids.length === 0) return false
  for (
    let start = 0;
    start < ids.length;
    start += VECTORIZE_DELETE_BATCH_SIZE
  ) {
    await index.deleteByIds(ids.slice(start, start + VECTORIZE_DELETE_BATCH_SIZE))
  }
  return true
}

export async function queryMemoryVectors(
  env: Env,
  input: {
    userId: string
    query: string
    topK?: number
    onLlmCall?: (call: LlmCallObservation) => void
  },
) {
  const embedding = await createEmbedding(env, input.query, {
    operation: "memory_embedding_query",
    onLlmCall: input.onLlmCall,
  })
  if (!embedding || !env.MEMORY_VECTORIZE) return []
  const result = await env.MEMORY_VECTORIZE.query(embedding, {
    topK: input.topK ?? 8,
    namespace: VECTOR_NAMESPACE,
    filter: { userId: input.userId },
    returnMetadata: "all",
  })
  return result.matches.map((match) => {
    const metadata = match.metadata as
      | {
          type?: string
          content?: string
          createdAt?: number
          validFrom?: number | null
          validTo?: number | null
        }
      | undefined
    return {
      id: match.id,
      type: metadata?.type ?? "memory",
      content: metadata?.content ?? "",
      createdAt: Number(metadata?.createdAt ?? Date.now()),
      validFrom:
        typeof metadata?.validFrom === "number" ? metadata.validFrom : null,
      validTo: typeof metadata?.validTo === "number" ? metadata.validTo : null,
      score: match.score,
    }
  })
}
