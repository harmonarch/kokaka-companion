import { router } from "expo-router"
import { useState } from "react"
import { useAuthStore } from "@/stores/authStore"

export function useAccountSessionActions(onDone: () => void) {
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const [busy, setBusy] = useState(false)

  async function signOut() {
    if (busy) return
    setBusy(true)
    try {
      await logout()
      setBusy(false)
      onDone()
      router.replace("/login")
    } catch (error) {
      setBusy(false)
      throw error
    }
  }

  async function deleteCurrentAccount() {
    if (busy) return
    setBusy(true)
    try {
      await deleteAccount()
      setBusy(false)
      onDone()
      router.replace("/login")
    } catch (error) {
      setBusy(false)
      throw error
    }
  }

  return {
    busy,
    signOut,
    deleteCurrentAccount,
  }
}
