'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AUTH_ERROR_PATH,
  completeOAuthExchange,
  errorDestination,
  readCodeVerifier,
} from './callback-flow'

export default function CallbackClient() {
  const searchParams = useSearchParams()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const providerError = searchParams.get('error')
    if (providerError) {
      const description = searchParams.get('error_description')
        ?? searchParams.get('error_code')
        ?? providerError
      window.location.replace(errorDestination(description))
      return
    }

    const code = searchParams.get('code')
    const codeVerifier = readCodeVerifier()
    if (!code) {
      window.location.replace(errorDestination('code OAuth absent de l URL de retour'))
      return
    }
    if (!codeVerifier) {
      window.location.replace(errorDestination('code verifier PKCE introuvable dans le stockage local'))
      return
    }

    void completeOAuthExchange(code, codeVerifier)
      .then(({ error }) => {
        if (error) {
          window.location.replace(errorDestination(error instanceof Error ? error.message : String(error ?? 'erreur inconnue')))
          return
        }
        window.location.replace('/')
      })
      .catch((error: unknown) => {
        window.location.replace(errorDestination(error instanceof Error ? error.message : String(error ?? 'exception')))
      })
  }, [searchParams])

  return <p className="text-sm text-foreground/60">Finalisation de la connexion…</p>
}

export { AUTH_ERROR_PATH }
