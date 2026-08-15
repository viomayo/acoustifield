'use client'

import { useEffect, useState } from 'react'

interface SWStatus {
  supported: boolean
  registered: boolean
  active: boolean
  swUrl: string | null
  cacheNames: string[]
  pong: boolean
}

export default function SWStatusPage() {
  const [status, setStatus] = useState<SWStatus>({
    supported: false,
    registered: false,
    active: false,
    swUrl: null,
    cacheNames: [],
    pong: false,
  })

  useEffect(() => {
    const check = async () => {
      const supported = 'serviceWorker' in navigator
      if (!supported) {
        setStatus((s) => ({ ...s, supported: false }))
        return
      }
      setStatus((s) => ({ ...s, supported: true }))

      const reg = await navigator.serviceWorker.getRegistration('/')
      if (!reg) {
        setStatus((s) => ({ ...s, registered: false }))
        return
      }
      setStatus((s) => ({
        ...s,
        registered: true,
        active: !!reg.active,
        swUrl: reg.active?.scriptURL ?? reg.installing?.scriptURL ?? null,
      }))

      // ping SW
      if (reg.active) {
        const channel = new MessageChannel()
        channel.port1.onmessage = (e) => {
          if (e.data?.type === 'SW_PONG') {
            setStatus((s) => ({ ...s, pong: true }))
          }
        }
        reg.active.postMessage({ type: 'SW_PING' }, [channel.port2])
      }

      // list caches
      if ('caches' in window) {
        const keys = await caches.keys()
        setStatus((s) => ({ ...s, cacheNames: keys }))
      }
    }
    check()
  }, [])

  return (
    <main className="min-h-screen bg-background text-foreground p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">Statut du Service Worker</h1>

      <section className="space-y-1 text-sm">
        <Row label="Navigateur supporte SW" value={status.supported} />
        <Row label="SW enregistré" value={status.registered} />
        <Row label="SW actif" value={status.active} />
        {status.swUrl && <Row label="URL du SW" value={status.swUrl} />}
        <Row label="SW répond" value={status.pong} />
        {status.cacheNames.length > 0 && (
          <Row label="Caches" value={status.cacheNames.join(', ')} />
        )}
      </section>

      <p className="text-xs text-foreground/40">
        Ouvre les DevTools &gt; Application &gt; Service Workers pour plus de détails.
      </p>
      <p className="text-xs text-foreground/40">
        Vérifie aussi que /sw.js est accessible :{' '}
        <a href="/sw.js" target="_blank" className="underline">
          /sw.js
        </a>
      </p>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string | boolean }) {
  return (
    <div className="flex justify-between border-b border-foreground/10 py-1">
      <span className="text-foreground/60">{label}</span>
      <span className={typeof value === 'boolean' ? (value ? 'text-green-500' : 'text-red-500') : ''}>
        {typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : value}
      </span>
    </div>
  )
}
