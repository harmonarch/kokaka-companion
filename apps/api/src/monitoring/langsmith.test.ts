import { describe, expect, it } from "vitest"
import type { Env } from "@/env"
import { createLangSmithTracer, langSmithClientConfig } from "./langsmith"

describe("LangSmith monitoring", () => {
  it("does not create a tracer until explicitly enabled", () => {
    expect(createLangSmithTracer({} as Env)).toBeUndefined()
  })

  it("always hides graph inputs and outputs", () => {
    expect(
      langSmithClientConfig({
        LANGSMITH_API_KEY: "secret",
        LANGSMITH_ENDPOINT: "https://example.com",
      } as Env),
    ).toMatchObject({ hideInputs: true, hideOutputs: true })
  })
})
