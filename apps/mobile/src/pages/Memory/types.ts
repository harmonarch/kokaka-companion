import type { Memory as MemoryItem } from "@ai-companion/shared"

export type MemoryTab = "preference" | "event" | "emotion_snapshot"

export type MemoryListItem =
  | {
      id: string
      kind: "section"
      title: string
    }
  | {
      id: string
      kind: "memory"
      memory: MemoryItem
      firstInSection: boolean
      lastInSection: boolean
    }

export const memoryTabs: MemoryTab[] = [
  "preference",
  "event",
  "emotion_snapshot",
]

export const tabLabels: Record<MemoryTab, string> = {
  preference: "偏好",
  event: "事件",
  emotion_snapshot: "情绪",
}

export const tabDescriptions: Record<MemoryTab, string> = {
  preference: "这些是你告诉我的偏好，我会在对话中尽量参考。",
  event: "这些是你提到的重要事件，我会用来理解上下文。",
  emotion_snapshot: "这些是你提到的持续情绪状态，我会用来理解近期感受。",
}
