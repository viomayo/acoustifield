'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function description(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get('description')
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export default function AuthCodeErrorClient() {
  const searchParams = useSearchParams()
  const detail = description(searchParams)

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
      <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
        <span className="text-background text-lg font-bold">C</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Connexion impossible</h1>
        <p className="text-sm text-foreground/50">
          La connexion Google n&apos;a pas pu être finalisée. Réessayez depuis la page de connexion.
        </p>
        {detail ? (
          <p className="text-xs text-foreground/40 break-all border-t border-foreground/10 pt-3">
            {detail}
          </p>
        ) : null}
      </div>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
      >
        Retour à la connexion
      </Link>
    </div>
  )
}
