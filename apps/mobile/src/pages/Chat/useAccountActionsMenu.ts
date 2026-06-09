import { router } from "expo-router"
import { useState } from "react"
import { useAuthStore } from "@/stores/authStore"

export function useAccountActionsMenu() {
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const [visible, setVisible] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function openMenu() {
    setVisible(true)
    setConfirmDelete(false)
  }

  function closeMenu() {
    setVisible(false)
    setConfirmDelete(false)
  }

  async function signOut() {
    await logout()
    closeMenu()
    router.replace("/login")
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteAccount()
    closeMenu()
    router.replace("/login")
  }

  return {
    visible,
    confirmDelete,
    openMenu,
    closeMenu,
    signOut,
    remove,
  }
}
