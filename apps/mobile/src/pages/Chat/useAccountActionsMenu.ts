import { useAccountMenuState } from "./hooks/useAccountMenuState"
import { useAccountSessionActions } from "./hooks/useAccountSessionActions"
import { useDeleteAccountConfirm } from "./hooks/useDeleteAccountConfirm"

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
