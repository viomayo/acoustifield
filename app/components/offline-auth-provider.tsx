'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthError, SupabaseClient, User } from '@supabase/supabase-js'
import { disableOfflineProfile, getOfflineProfile, setOfflineProfile, type OfflineProfile } from '@/lib/idb'
import { createClient } from '@/lib/supabase/client'

export type OfflineAuthStatus = 'loading' | 'online' | 'offline' | 'expired' | 'unauthenticated'

export interface LocalIdentity {
  ownerId: string
  displayName: string
  avatarUrl: string | null
}

export interface OfflineAuthState {
  status: OfflineAuthStatus
  user: LocalIdentity | null
  isOnlineAuthenticated: boolean
  logout: () => Promise<void>
  updateDisplayName: (name: string) => Promise<void>
}

type OfflineAuthSnapshot = Omit<OfflineAuthState, 'logout' | 'updateDisplayName'>

const LOADING_STATE: OfflineAuthSnapshot = {
  status: 'loading',
  user: null,
  isOnlineAuthenticated: false,
}

const OfflineAuthContext = createContext<OfflineAuthState | undefined>(undefined)

function identityFromProfile(profile: OfflineProfile): LocalIdentity {
  return {
    ownerId: profile.ownerId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  }
}

function identityFromUser(user: User): LocalIdentity {
  const metadata = user.user_metadata as Record<string, unknown>
  const displayName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    user.email ||
    'Utilisateur'
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null
  return { ownerId: user.id, displayName, avatarUrl }
}

async function fetchProfileName(supabase: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('profiles').select('nom').eq('id', userId).maybeSingle()
    const nom = (data as { nom?: string | null } | null)?.nom?.trim()
    return nom || null
  } catch {
    return null
  }
}

function isInvalidSession(error: AuthError | null): boolean {
  if (!error) return false
  return (
    error.name === 'AuthSessionMissingError' ||
    error.status === 401 ||
    error.status === 403 ||
    error.code === 'bad_jwt' ||
    error.code === 'session_not_found'
  )
}

export default function OfflineAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OfflineAuthSnapshot>(LOADING_STATE)
  const supabase = useMemo(() => createClient(), [])

  const logout = useCallback(async () => {
    // Le verrouillage en mémoire est immédiat. Sa persistance locale précède
    // toujours la tentative réseau, afin qu'une panne ne réactive pas le profil.
    setState({ status: 'unauthenticated', user: null, isOnlineAuthenticated: false })
    await disableOfflineProfile()
    try {
      await supabase.auth.signOut()
    } catch {
      // La déconnexion locale volontaire reste effective hors ligne.
    }
  }, [supabase])

  const updateDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim()
    const ownerId = state.user?.ownerId
    if (!ownerId || !trimmed) return
    setState((prev) =>
      prev.user
        ? { ...prev, user: { ...prev.user, displayName: trimmed } }
        : prev,
    )
    try {
      await supabase.from('profiles').upsert({ id: ownerId, nom: trimmed })
    } catch {
      // Hors ligne : le renommage reste local et sera réappliqué à la prochaine connexion.
    }
    const current = await getOfflineProfile().catch(() => null)
    if (current && current.ownerId === ownerId) {
      await setOfflineProfile({
        ...current,
        displayName: trimmed,
        lastVerifiedAt: new Date().toISOString(),
      }).catch(() => undefined)
    }
  }, [state.user, supabase])

  useEffect(() => {
    let active = true

    async function resolveIdentity() {
      const localProfilePromise = getOfflineProfile().catch(() => null)
      let remoteResult: Awaited<ReturnType<typeof supabase.auth.getUser>>

      try {
        remoteResult = await supabase.auth.getUser()
      } catch {
        const localProfile = await localProfilePromise
        if (!active) return
        setState(localProfile
          ? { status: 'offline', user: identityFromProfile(localProfile), isOnlineAuthenticated: false }
          : { status: 'unauthenticated', user: null, isOnlineAuthenticated: false })
        return
      }

      const { data, error } = remoteResult
      const localProfile = await localProfilePromise
      if (!active) return

      if (data.user && !error) {
        const identity = identityFromUser(data.user)
        const profileName = await fetchProfileName(supabase, data.user.id)
        const resolved = profileName ? { ...identity, displayName: profileName } : identity
        const verifiedProfile: OfflineProfile = {
          ...resolved,
          lastVerifiedAt: new Date().toISOString(),
          preparedVersion: localProfile?.ownerId === identity.ownerId
            ? localProfile.preparedVersion
            : null,
          offlineEnabled: true,
        }
        try {
          await setOfflineProfile(verifiedProfile)
        } catch {
          // The remotely verified identity remains authoritative for this run.
          // Readiness will later report that local persistence is unavailable.
        }
        if (!active) return
        setState({ status: 'online', user: resolved, isOnlineAuthenticated: true })
        return
      }

      if (localProfile) {
        setState({
          status: isInvalidSession(error) || !error ? 'expired' : 'offline',
          user: identityFromProfile(localProfile),
          isOnlineAuthenticated: false,
        })
        return
      }

      setState({ status: 'unauthenticated', user: null, isOnlineAuthenticated: false })
    }

    void resolveIdentity()
    const revalidateOnlineIdentity = () => { void resolveIdentity() }
    window.addEventListener('online', revalidateOnlineIdentity)
    return () => {
      active = false
      window.removeEventListener('online', revalidateOnlineIdentity)
    }
  }, [supabase])

  const contextValue = useMemo(() => ({ ...state, logout, updateDisplayName }), [logout, state, updateDisplayName])

  return <OfflineAuthContext.Provider value={contextValue}>{children}</OfflineAuthContext.Provider>
}

export function useOfflineAuth(): OfflineAuthState {
  const context = useContext(OfflineAuthContext)
  if (!context) throw new Error('useOfflineAuth doit être utilisé dans OfflineAuthProvider')
  return context
}
