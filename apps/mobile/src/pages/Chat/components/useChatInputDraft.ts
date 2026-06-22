import { useState } from "react"

export function useChatInputDraft({
  disabled,
  onTyping,
  onSend,
}: {
  disabled?: boolean
  onTyping?: () => void
  onSend: (content: string) => Promise<void>
}) {
  const [value, setValue] = useState("")
  const trimmedValue = value.trim()
  const cannotSend = disabled || !trimmedValue

  function setDraftValue(nextValue: string) {
    setValue(nextValue)
    if (!disabled && nextValue.trim()) onTyping?.()
  }

  function submit() {
    if (cannotSend) return
    void onSend(trimmedValue)
      .then(() => setValue(""))
      .catch(() => undefined)
  }

  return {
    value,
    setValue: setDraftValue,
    cannotSend,
    submit,
  }
}
