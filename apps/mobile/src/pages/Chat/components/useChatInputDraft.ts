import { useState } from "react"

export function useChatInputDraft({
  disabled,
  onSend,
}: {
  disabled?: boolean
  onSend: (content: string) => void
}) {
  const [value, setValue] = useState("")
  const trimmedValue = value.trim()
  const cannotSend = disabled || !trimmedValue

  function submit() {
    if (cannotSend) return
    onSend(trimmedValue)
    setValue("")
  }

  return {
    value,
    setValue,
    cannotSend,
    submit,
  }
}
