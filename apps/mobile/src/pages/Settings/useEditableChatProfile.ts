import type { ChatProfile } from "@ai-companion/shared"
import { useEffect, useState } from "react"
import { useProfileStore } from "@/stores/profileStore"
import { pickAvatarImage } from "./pickAvatarImage"
import type { ProfileRole } from "./types"

export function formatChatProfileDraft({
  nickname,
  avatar,
}: {
  nickname: string
  avatar: string
}): ChatProfile {
  return {
    nickname: nickname || null,
    avatar_url: avatar || null,
  }
}

export function useEditableChatProfile({
  role,
  onError,
}: {
  role: ProfileRole
  onError: (error: string | null) => void
}) {
  const profiles = useProfileStore((state) => state.profiles)
  const profilesReady = useProfileStore((state) => state.ready)
  const [nickname, setNickname] = useState(profiles[role].nickname ?? "")
  const [avatar, setAvatar] = useState(profiles[role].avatar_url ?? "")

  useEffect(() => {
    if (!profilesReady) return
    setNickname(profiles[role].nickname ?? "")
    setAvatar(profiles[role].avatar_url ?? "")
  }, [profiles, profilesReady, role])

  async function pickAvatar() {
    onError(null)
    const result = await pickAvatarImage()
    if (result.error) {
      onError(result.error)
      return
    }
    if (result.avatar) setAvatar(result.avatar)
  }

  function createProfile() {
    return formatChatProfileDraft({ nickname, avatar })
  }

  return {
    nickname,
    setNickname,
    avatar,
    pickAvatar,
    createProfile,
  }
}
