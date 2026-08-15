'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useOfflineAuth } from './offline-auth-provider'

export default function LogoutButton() {
  const router = useRouter()
  const { logout } = useOfflineAuth()

  const signOut = async () => {
    try {
      await logout()
    } finally {
      router.push('/login')
    }
  }

  return (
    <button
      onClick={signOut}
      title="Se déconnecter"
      className="flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
    >
      <LogOut size={15} className="shrink-0" />
      <span className="hidden sm:inline">Se déconnecter</span>
    </button>
  )
}
