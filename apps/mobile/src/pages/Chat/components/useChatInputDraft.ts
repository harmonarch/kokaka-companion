import { useState } from "react"

export function useChatInputDraft({
  disabled,
  onSend,
}: {
  disabled?: boolean
  onSend: (content: string) => void
}) {
  const [value, setValue] = useState("")
  const cannotSend = disabled || !value.trim()

  function submit() {
    if (cannotSend) return
    onSend(value)
    setValue("")
  }

  return {
    value,
    setValue,
    cannotSend,
    submit,
  }
}
