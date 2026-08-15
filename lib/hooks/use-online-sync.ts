'use client'

import { useEffect } from 'react'

export function useOnlineSync(onSync: () => void, enabled: boolean) {
  useEffect(() => {
    function handleOnline() {
      if (enabled && navigator.onLine) {
        onSync()
      }
    }

    window.addEventListener('online', handleOnline)
    const startup = enabled && navigator.onLine
      ? window.setTimeout(handleOnline, 0)
      : null

    return () => {
      if (startup !== null) window.clearTimeout(startup)
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, onSync])
}
