import { useEffect, useState } from "react"
import { router } from "expo-router"
import { useAuthStore } from "@/stores/authStore"
import type { LoginMode } from "./useLoginForm"

export function useLogin() {
  const [error, setError] = useState<string | null>(null)

  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (user) {
      router.replace("/chat")
    }
  }, [user])

  async function submit(
    email: string,
    password: string,
    nickname: string,
    mode: LoginMode,
  ) {
    setError(null)
    try {
      if (mode === "register") {
        await register(email, password, nickname)
      } else {
        await login(email, password)
      }
      router.replace("/chat")
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败")
    }
  }

  return {
    error,
    submit,
  }
}
