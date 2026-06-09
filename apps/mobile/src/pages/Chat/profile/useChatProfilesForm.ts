import { useEditableChatProfile } from "./useEditableChatProfile"

export function useChatProfilesForm({
  onError,
}: {
  onError: (error: string | null) => void
}) {
  const userProfile = useEditableChatProfile({ role: "user", onError })
  const agentProfile = useEditableChatProfile({ role: "agent", onError })

  function createProfiles() {
    return {
      user: userProfile.createProfile(),
      agent: agentProfile.createProfile(),
    }
  }

  return {
    userProfile,
    agentProfile,
    createProfiles,
  }
}
