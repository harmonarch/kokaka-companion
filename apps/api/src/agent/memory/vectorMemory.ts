import type { Env } from "@/env"

const VECTOR_NAMESPACE = "long_term_memory"

function hasVectorize(env: Env) {
  return Boolean(
    env.MEMORY_VECTORIZE &&
    env.EMBEDDING_BASE_URL &&
    env.EMBEDDING_MODEL &&
    env.EMBEDDING_API_KEY,
  )
}

async function createEmbedding(env: Env, input: string) {
  if (!hasVectorize(env)) return null
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
  if (!response.ok) return null
  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>
  }
  return data.data?.[0]?.embedding ?? null
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
  },
) {
  const embedding = await createEmbedding(env, input.content)
  if (!embedding || !env.MEMORY_VECTORIZE) return false
  await env.MEMORY_VECTORIZE.upsert([
    {
      id: input.id,
      values: embedding,
      namespace: VECTOR_NAMESPACE,
      metadata: memoryVectorMetadata(input),
    },
  ])
  return true
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

export async function queryMemoryVectors(
  env: Env,
  input: {
    userId: string
    query: string
    topK?: number
  },
) {
  const embedding = await createEmbedding(env, input.query)
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
