import { router } from "expo-router"
import { useAuthStore } from "@/stores/authStore"

export function useAccountSessionActions(onDone: () => void) {
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)

  async function signOut() {
    await logout()
    onDone()
    router.replace("/login")
  }

  async function deleteCurrentAccount() {
    await deleteAccount()
    onDone()
    router.replace("/login")
  }

  return {
    signOut,
    deleteCurrentAccount,
  }
}
