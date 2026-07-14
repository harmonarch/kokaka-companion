import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain"
import { Client } from "langsmith"
import type { Env } from "@/env"

export function langSmithClientConfig(env: Env) {
  return {
    apiKey: env.LANGSMITH_API_KEY,
    apiUrl: env.LANGSMITH_ENDPOINT,
    hideInputs: true,
    hideOutputs: true,
  }
}

export function createLangSmithTracer(env: Env) {
  if (env.LANGSMITH_TRACING !== "true" || !env.LANGSMITH_API_KEY) {
    return undefined
  }

  return new LangChainTracer({
    projectName: env.LANGSMITH_PROJECT ?? "kokaka-companion",
    client: new Client(langSmithClientConfig(env)),
  })
}
