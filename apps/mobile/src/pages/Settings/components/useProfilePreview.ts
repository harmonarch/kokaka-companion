import type { ChatProfile } from "@ai-companion/shared"
import { useEffect, useState } from "react"
import { useProfileStore } from "@/stores/profileStore"

type ProfileRole = "user" | "agent"

export function useProfilePreview({ role }: { role: ProfileRole }) {
  const profiles = useProfileStore((state) => state.profiles)
  const profilesReady = useProfileStore((state) => state.ready)
  const [nickname, setNickname] = useState(profiles[role].nickname ?? "")

  useEffect(() => {
    if (!profilesReady) return
    setNickname(profiles[role].nickname ?? "")
  }, [profiles, profilesReady, role])

  function createProfile(avatar: string): ChatProfile {
    return {
      nickname: nickname || null,
      avatar_url: avatar || null,
    }
  }

  return {
    nickname,
    setNickname,
    createProfile,
  }
}
