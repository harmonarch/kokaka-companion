import { useState } from "react"

export function useDeleteAccountConfirm() {
  const [confirmDelete, setConfirmDelete] = useState(false)

  function requestDeleteConfirmation() {
    setConfirmDelete(true)
  }

  function cancelDelete() {
    setConfirmDelete(false)
  }

  return {
    confirmDelete,
    requestDeleteConfirmation,
    cancelDelete,
  }
}
