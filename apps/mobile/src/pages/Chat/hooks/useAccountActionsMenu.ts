import { useAccountMenuState } from "./useAccountMenuState"
import { useAccountSessionActions } from "./useAccountSessionActions"
import { router } from "expo-router"
import { useState } from "react"
import type { AccountAction } from "../components/AccountActionConfirmDialog"

export function useAccountActionsMenu() {
  const menu = useAccountMenuState()
  const [confirmAction, setConfirmAction] = useState<AccountAction | null>(null)
  const sessionActions = useAccountSessionActions(() => {
    setConfirmAction(null)
    menu.closeMenu()
  })

  function openMenu() {
    setConfirmAction(null)
    menu.openMenu()
  }

  function closeMenu() {
    setConfirmAction(null)
    menu.closeMenu()
  }

  function openMemoryManager() {
    closeMenu()
    router.push("/memory")
  }

  function signOut() {
    setConfirmAction("logout")
  }

  function remove() {
    setConfirmAction("delete")
  }

  function cancelConfirm() {
    if (!sessionActions.busy) setConfirmAction(null)
  }

  function confirmSelectedAction() {
    if (confirmAction === "logout") void sessionActions.signOut()
    if (confirmAction === "delete") void sessionActions.deleteCurrentAccount()
  }

  return {
    visible: menu.visible,
    confirmAction,
    loading: sessionActions.busy,
    openMenu,
    closeMenu,
    openMemoryManager,
    signOut,
    remove,
    cancelConfirm,
    confirmSelectedAction,
  }
}
