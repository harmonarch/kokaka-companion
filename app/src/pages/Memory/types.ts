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
  preference: "会在对话中优先参考的个人偏好。",
  event: "用于理解上下文的重要事件。",
  emotion_snapshot: "用于理解近期感受的持续情绪状态。",
}
