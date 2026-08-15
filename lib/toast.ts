export type ToastKind = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

export const TOAST_EVENT = 'acoustifield-toast'

let counter = 0

export function showToast(text: string, kind: ToastKind = 'info'): void {
  if (typeof window === 'undefined') return
  counter += 1
  window.dispatchEvent(new CustomEvent<ToastMessage>(TOAST_EVENT, {
    detail: { id: counter, kind, text },
  }))
}
