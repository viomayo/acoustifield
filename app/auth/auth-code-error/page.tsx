import { Suspense } from 'react'
import AuthCodeErrorClient from './error-client'

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 text-foreground">
      <Suspense
        fallback={
          <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
            <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
              <span className="text-background text-lg font-bold">C</span>
            </div>
            <p className="text-sm text-foreground/50">Connexion impossible</p>
          </div>
        }
      >
        <AuthCodeErrorClient />
      </Suspense>
    </main>
  )
}
