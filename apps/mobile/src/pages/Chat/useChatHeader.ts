import { useProfileStore } from "@/stores/profileStore"

export function useChatHeader() {
  const agentNickname = useProfileStore((state) =>
    state.profiles.agent.nickname?.trim(),
  )

  return {
    chatTitle: agentNickname || "今天想说什么",
  }
}
