import { useProfileStore } from "@/stores/profileStore"
import { useChatStore } from "@/stores/chatStore"

export function useChatHeader() {
  const agentNickname = useProfileStore((state) =>
    state.profiles.agent.nickname?.trim(),
  )
  const agentPresence = useChatStore((state) => state.agentPresence)

  const agentStatusText =
    agentPresence === "listening"
      ? "正在倾听..."
      : agentPresence === "replying"
        ? "正在输入..."
        : null

  return {
    chatTitle: agentNickname || "你的 Agent",
    agentStatusText,
  }
}
