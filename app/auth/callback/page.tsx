import { Suspense } from 'react'
import CallbackClient from './callback-client'

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-6 text-center">
      <Suspense fallback={<p className="text-sm text-foreground/60">Finalisation de la connexion…</p>}>
        <CallbackClient />
      </Suspense>
    </main>
  )
}
