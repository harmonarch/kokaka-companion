import { create } from "zustand"

export type ToastTone = "success" | "danger"

type ToastState = {
  message: string | null
  tone: ToastTone
  showToast: (message: string, tone?: ToastTone) => void
  hideToast: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: "danger",
  showToast: (message, tone = "danger") => set({ message, tone }),
  hideToast: () => set({ message: null, tone: "danger" }),
}))
