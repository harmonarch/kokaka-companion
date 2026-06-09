import { useEffect, useState } from "react"
import type { User } from "@ai-companion/shared"

export function useSettingsAccountForm(user: User | null) {
  const [nickname, setNickname] = useState(user?.nickname ?? "")

  useEffect(() => {
    setNickname(user?.nickname ?? "")
  }, [user?.nickname])

  return {
    nickname,
    setNickname,
  }
}
