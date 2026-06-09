import { useState } from "react"

export function useAccountMenuState() {
  const [visible, setVisible] = useState(false)

  function openMenu() {
    setVisible(true)
  }

  function closeMenu() {
    setVisible(false)
  }

  return {
    visible,
    openMenu,
    closeMenu,
  }
}
