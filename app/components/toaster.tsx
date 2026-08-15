'use client'

import { useEffect, useRef, useState } from 'react'
import { TOAST_EVENT, type ToastMessage } from '@/lib/toast'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timeouts = useRef(new Map<number, number>())

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<ToastMessage>).detail
      setToasts((prev) => [...prev.slice(-3), detail])
      const timeout = window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== detail.id))
        timeouts.current.delete(detail.id)
      }, 3200)
      timeouts.current.set(detail.id, timeout)
    }
    window.addEventListener(TOAST_EVENT, handle)
    const registered = timeouts.current
    return () => {
      window.removeEventListener(TOAST_EVENT, handle)
      for (const timeout of registered.values()) window.clearTimeout(timeout)
      registered.clear()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-4 z-[1000] flex flex-col gap-2 w-72">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-xl border border-foreground/10 bg-white shadow-lg px-4 py-3 flex items-start gap-2.5 text-sm"
        >
          {toast.kind === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />}
          {toast.kind === 'error' && <XCircle size={16} className="text-red-600 shrink-0 mt-0.5" />}
          {toast.kind === 'info' && <Info size={16} className="text-accent shrink-0 mt-0.5" />}
          <span className="text-foreground/80">{toast.text}</span>
        </div>
      ))}
    </div>
  )
}
