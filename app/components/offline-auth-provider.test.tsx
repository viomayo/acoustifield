import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OfflineAuthProvider, { useOfflineAuth } from './offline-auth-provider'
import type { OfflineProfile } from '@/lib/idb'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOfflineProfile: vi.fn(),
  setOfflineProfile: vi.fn(),
  disableOfflineProfile: vi.fn(),
  signOut: vi.fn(),
  profileRow: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser, signOut: mocks.signOut },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.profileRow }) }),
      upsert: mocks.upsert,
    }),
  }),
}))

vi.mock('@/lib/idb', () => ({
  getOfflineProfile: mocks.getOfflineProfile,
  setOfflineProfile: mocks.setOfflineProfile,
  disableOfflineProfile: mocks.disableOfflineProfile,
}))

function profile(ownerId = 'user-a'): OfflineProfile {
  return {
    ownerId,
    displayName: `Utilisateur ${ownerId}`,
    avatarUrl: null,
    lastVerifiedAt: '2026-08-05T20:00:00.000Z',
    preparedVersion: 'shell-v1',
    offlineEnabled: true,
  }
}

function remoteUser(id = 'user-a') {
  return {
    id,
    email: `${id}@example.test`,
    user_metadata: { full_name: `Distant ${id}`, avatar_url: `https://example.test/${id}.png` },
  }
}

function Probe() {
  const auth = useOfflineAuth()
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="owner">{auth.user?.ownerId ?? 'none'}</span>
      <span data-testid="online">{String(auth.isOnlineAuthenticated)}</span>
      <span data-testid="name">{auth.user?.displayName ?? 'none'}</span>
      <button onClick={() => void auth.logout()}>Déconnexion test</button>
      <button onClick={() => void auth.updateDisplayName('Nouveau Nom')}>Renommer test</button>
    </div>
  )
}

function renderProvider() {
  return render(<OfflineAuthProvider><Probe /></OfflineAuthProvider>)
}

describe('OfflineAuthProvider', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOfflineProfile.mockResolvedValue(null)
    mocks.setOfflineProfile.mockResolvedValue(undefined)
    mocks.disableOfflineProfile.mockResolvedValue(undefined)
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.profileRow.mockResolvedValue({ data: null, error: null })
    mocks.upsert.mockResolvedValue({ data: null, error: null })
  })

  it('starts without exposing an owner while identity resolution is pending', async () => {
    let finish!: (value: unknown) => void
    mocks.getUser.mockReturnValue(new Promise((resolve) => { finish = resolve }))

    renderProvider()

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    expect(screen.getByTestId('owner')).toHaveTextContent('none')
    expect(screen.getByTestId('online')).toHaveTextContent('false')

    await act(async () => finish({ data: { user: null }, error: null }))
  })

  it('confirms a remote user, refreshes the profile and exposes online identity', async () => {
    const previous = profile()
    const verifiedAfter = Date.now()
    mocks.getOfflineProfile.mockResolvedValue(previous)
    mocks.getUser.mockResolvedValue({ data: { user: remoteUser() }, error: null })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
    expect(screen.getByTestId('owner')).toHaveTextContent('user-a')
    expect(screen.getByTestId('online')).toHaveTextContent('true')
    expect(mocks.setOfflineProfile).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'user-a',
      displayName: 'Distant user-a',
      avatarUrl: 'https://example.test/user-a.png',
      preparedVersion: 'shell-v1',
      offlineEnabled: true,
    }))
    const saved = mocks.setOfflineProfile.mock.calls[0][0] as OfflineProfile
    expect(Date.parse(saved.lastVerifiedAt)).toBeGreaterThanOrEqual(verifiedAfter)
  })

  it('uses the active profile offline when Supabase is unreachable', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' },
    })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('offline'))
    expect(screen.getByTestId('owner')).toHaveTextContent('user-a')
    expect(screen.getByTestId('online')).toHaveTextContent('false')
    expect(mocks.setOfflineProfile).not.toHaveBeenCalled()
    expect(mocks.disableOfflineProfile).not.toHaveBeenCalled()
  })

  it('stays unauthenticated when Supabase is unreachable and no profile exists', async () => {
    mocks.getUser.mockRejectedValue(new TypeError('Failed to fetch'))

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(screen.getByTestId('owner')).toHaveTextContent('none')
  })

  it('marks a local identity expired when the remote session is invalid', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 },
    })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('expired'))
    expect(screen.getByTestId('owner')).toHaveTextContent('user-a')
    expect(screen.getByTestId('online')).toHaveTextContent('false')
    expect(mocks.disableOfflineProfile).not.toHaveBeenCalled()
  })

  it('replaces profile A with remotely confirmed user B without disabling A', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile('user-a'))
    mocks.getUser.mockResolvedValue({ data: { user: remoteUser('user-b') }, error: null })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('owner')).toHaveTextContent('user-b'))
    expect(screen.getByTestId('status')).toHaveTextContent('online')
    expect(mocks.setOfflineProfile).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'user-b',
      preparedVersion: null,
    }))
    expect(mocks.disableOfflineProfile).not.toHaveBeenCalled()
  })

  it('never falls back to profile A after remotely confirming B if persistence fails', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile('user-a'))
    mocks.getUser.mockResolvedValue({ data: { user: remoteUser('user-b') }, error: null })
    mocks.setOfflineProfile.mockRejectedValue(new Error('IndexedDB indisponible'))

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
    expect(screen.getByTestId('owner')).toHaveTextContent('user-b')
    expect(screen.getByTestId('online')).toHaveTextContent('true')
  })

  it('prefers the controlled profile name over identity metadata', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser.mockResolvedValue({ data: { user: remoteUser() }, error: null })
    mocks.profileRow.mockResolvedValue({ data: { nom: '  Violette Mayaux  ' }, error: null })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
    expect(screen.getByTestId('name')).toHaveTextContent('Violette Mayaux')
    expect(mocks.setOfflineProfile).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'user-a',
      displayName: 'Violette Mayaux',
      preparedVersion: 'shell-v1',
    }))
  })

  it('renames the controlled profile and refreshes the local identity', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser.mockResolvedValue({ data: { user: remoteUser() }, error: null })

    renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
    fireEvent.click(screen.getByRole('button', { name: 'Renommer test' }))

    expect(screen.getByTestId('name')).toHaveTextContent('Nouveau Nom')
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith({ id: 'user-a', nom: 'Nouveau Nom' }))
    expect(mocks.setOfflineProfile).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Nouveau Nom' }))
  })

  it('persists the local rename when the remote upsert fails', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser.mockResolvedValue({ data: { user: remoteUser() }, error: null })
    mocks.upsert.mockResolvedValue({ data: null, error: { message: 'offline' } })

    renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
    fireEvent.click(screen.getByRole('button', { name: 'Renommer test' }))

    expect(screen.getByTestId('name')).toHaveTextContent('Nouveau Nom')
    await waitFor(() => expect(mocks.setOfflineProfile).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Nouveau Nom' })))
  })

  it('locks the local profile before completing an online logout', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser.mockResolvedValue({ data: { user: remoteUser() }, error: null })

    renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
    fireEvent.click(screen.getByRole('button', { name: 'Déconnexion test' }))

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('owner')).toHaveTextContent('none')
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())
    expect(mocks.disableOfflineProfile.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.signOut.mock.invocationCallOrder[0])
  })

  it('keeps the UI locked when remote sign-out fails offline', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' },
    })
    mocks.signOut.mockRejectedValue(new TypeError('Failed to fetch'))

    renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Déconnexion test' }))

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('owner')).toHaveTextContent('none')
    await waitFor(() => expect(mocks.disableOfflineProfile).toHaveBeenCalledOnce())
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())
    expect(mocks.disableOfflineProfile.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.signOut.mock.invocationCallOrder[0])
  })

  it('revalidates the remote identity when the browser comes back online', async () => {
    mocks.getOfflineProfile.mockResolvedValue(profile())
    mocks.getUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' },
      })
      .mockResolvedValueOnce({ data: { user: remoteUser() }, error: null })

    renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('offline'))

    window.dispatchEvent(new Event('online'))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
    expect(mocks.getUser).toHaveBeenCalledTimes(2)
  })
})
