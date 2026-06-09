import { useAccountMenuState } from "./useAccountMenuState"
import { useAccountSessionActions } from "./useAccountSessionActions"
import { useDeleteAccountConfirm } from "./useDeleteAccountConfirm"

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
    signOut: sessionActions.signOut,
    remove,
  }
}
