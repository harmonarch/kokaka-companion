import { describe, expect, it } from "vitest";
import { classifyEmotion } from "@/agent/nodes/emotion";
import { generateReplyWithDeepSeek } from "@/agent/nodes/generate";
import type { Env } from "@/env";

const env = {
  DEEPSEEK_API_KEY: "",
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  DEEPSEEK_MODEL: "deepseek-chat"
} as Env;

describe("P0 agent", () => {
  it("classifies the four required emotion states", () => {
    expect(classifyEmotion("今天很普通")).toBe("normal");
    expect(classifyEmotion("今天有点累")).toBe("vulnerable");
    expect(classifyEmotion("我不想活了")).toBe("crisis");
    expect(classifyEmotion("今天太开心了")).toBe("positive");
  });

  it("keeps vulnerable fallback free of direct advice language", async () => {
    const reply = await generateReplyWithDeepSeek(env, {
      userId: "u1",
      userMessage: "今天有点累",
      context: [],
      emotionState: "vulnerable",
      reasoning: "",
      strategy: "共情确认，轻声追问，不给建议。",
      reply: ""
    });

    expect(reply).not.toContain("你应该");
    expect(reply).not.toContain("建议你");
  });
});
