import { useAccountMenuState } from "./useAccountMenuState"
import { useAccountSessionActions } from "./useAccountSessionActions"
import { useDeleteAccountConfirm } from "./useDeleteAccountConfirm"
import { router } from "expo-router"

export function useAccountActionsMenu() {
  const deleteConfirm = useDeleteAccountConfirm()
  const menu = useAccountMenuState()
  const sessionActions = useAccountSessionActions(menu.closeMenu)

  function openMenu() {
    deleteConfirm.cancelDelete()
    menu.openMenu()
  }

  function closeMenu() {
    deleteConfirm.cancelDelete()
    menu.closeMenu()
  }

  function openMemoryManager() {
    closeMenu()
    router.push("/memory")
  }

  async function remove() {
    if (!deleteConfirm.confirmDelete) {
      deleteConfirm.requestDeleteConfirmation()
      return
    }
    await sessionActions.deleteCurrentAccount()
  }

  return {
    visible: menu.visible,
    confirmDelete: deleteConfirm.confirmDelete,
    openMenu,
    closeMenu,
    openMemoryManager,
    signOut: sessionActions.signOut,
    remove,
  }
}
