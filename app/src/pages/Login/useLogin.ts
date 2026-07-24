import { useEffect, useState } from "react"
import { router } from "expo-router"
import { useAuthStore } from "@/stores/authStore"
import { useToastStore } from "@/stores/toastStore"
import { getNetworkErrorMessage, getReadableErrorMessage } from "@/utils/errors"
import { getAuthFieldsError } from "./authValidation"
import type { LoginMode } from "./useLoginForm"

export function useLogin() {
  const [error, setError] = useState<string | null>(null)

  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const showToast = useToastStore((state) => state.showToast)
  const user = useAuthStore((state) => state.user)
  const ready = useAuthStore((state) => state.ready)
  const tokens = useAuthStore((state) => state.tokens)
  const restoringUser = !ready || Boolean(tokens && !user)

  useEffect(() => {
    if (user) {
      router.replace("/chats")
    }
  }, [user])

  async function submit(
    email: string,
    password: string,
    nickname: string,
    mode: LoginMode,
  ) {
    setError(null)
    const validationError = getAuthFieldsError(email, password)
    if (validationError) {
      showToast(validationError)
      return
    }

    try {
      if (mode === "register") {
        await register(email, password, nickname)
      } else {
        await login(email, password)
      }
      router.replace("/chats")
    } catch (err) {
      const networkError = getNetworkErrorMessage(err)
      if (networkError) showToast(networkError)
      setError(getReadableErrorMessage(err, "操作失败"))
    }
  }

  return {
    error,
    restoringUser,
    user,
    submit,
  }
}
