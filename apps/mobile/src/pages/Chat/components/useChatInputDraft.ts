import { useState } from "react"

export function useChatInputDraft({
  disabled,
  onSend,
}: {
  disabled?: boolean
  onSend: (content: string) => Promise<void>
}) {
  const [value, setValue] = useState("")
  const trimmedValue = value.trim()
  const cannotSend = disabled || !trimmedValue

  function submit() {
    if (cannotSend) return
    void onSend(trimmedValue)
      .then(() => setValue(""))
      .catch(() => undefined)
  }

  return {
    value,
    setValue,
    cannotSend,
    submit,
  }
}
