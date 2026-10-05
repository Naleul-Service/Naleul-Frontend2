import { create } from 'zustand'

export type ToastTone = 'default' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = 'default') => {
    const id = ++seq
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] }) // 최대 3개
    setTimeout(() => get().dismiss(id), 2800)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

/** 컴포넌트 밖(예: mutation onError)에서도 쓸 수 있는 단축 함수 */
export const toast = {
  show: (message: string) => useToastStore.getState().show(message),
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  error: (message: string) => useToastStore.getState().show(message, 'error'),
}
