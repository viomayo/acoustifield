import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OfflineStatusIndicator from './offline-status'
import type { OfflineAuthState } from './offline-auth-provider'
import type { OfflineStatus } from '@/lib/offline/readiness'

let authState: OfflineAuthState

const mocks = vi.hoisted(() => ({
  getOfflineStatus: vi.fn(),
  prepareOffline: vi.fn(),
  setOfflinePreparedVersion: vi.fn(),
}))

vi.mock('./offline-auth-provider', () => ({ useOfflineAuth: () => authState }))
vi.mock('@/lib/offline/readiness', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/offline/readiness')>()
  return {
    ...original,
    CURRENT_SHELL_VERSION: 'build-current',
    getOfflineStatus: mocks.getOfflineStatus,
    prepareOffline: mocks.prepareOffline,
  }
})
vi.mock('@/lib/idb', () => ({ setOfflinePreparedVersion: mocks.setOfflinePreparedVersion }))

const user = { ownerId: 'user-a', displayName: 'Utilisateur A', avatarUrl: null }
const routes = { '/': true, '/recapitulatif': true } as const

function status(overrides: Partial<OfflineStatus> = {}): OfflineStatus {
  return { version: 'build-current', ready: true, routes: { ...routes }, ...overrides }
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

describe('OfflineStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setOnline(true)
    authState = { status: 'online', user, isOnlineAuthenticated: true, logout: vi.fn(), updateDisplayName: vi.fn() }
    mocks.setOfflinePreparedVersion.mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('shows verification while offline status is unresolved', () => {
    authState = { ...authState, status: 'offline', isOnlineAuthenticated: false }
    mocks.getOfflineStatus.mockReturnValue(new Promise(() => {}))

    render(<OfflineStatusIndicator />)

    expect(screen.getByText('Vérification du mode hors ligne…')).toBeVisible()
  })

  it('automatically prepares online and displays ready only after SW confirmation', async () => {
    mocks.prepareOffline.mockResolvedValue(status())

    render(<OfflineStatusIndicator />)

    expect(await screen.findByText('En ligne — Prêt hors ligne')).toBeVisible()
    expect(mocks.prepareOffline).toHaveBeenCalledOnce()
    expect(mocks.setOfflinePreparedVersion).toHaveBeenCalledWith('user-a', 'build-current')
  })

  it('shows offline and ready after an offline startup check', async () => {
    setOnline(false)
    authState = { ...authState, status: 'offline', isOnlineAuthenticated: false }
    mocks.getOfflineStatus.mockResolvedValue(status())

    render(<OfflineStatusIndicator />)

    expect(await screen.findByText('Hors ligne — application prête')).toBeVisible()
    expect(mocks.prepareOffline).not.toHaveBeenCalled()
  })

  it('never displays ready when a route is missing', async () => {
    mocks.prepareOffline.mockResolvedValue(status({
      ready: false,
      routes: { ...routes, '/recapitulatif': false },
    }))

    render(<OfflineStatusIndicator />)

    expect(await screen.findByText('Mode hors ligne incomplet')).toBeVisible()
    expect(screen.queryByText(/Prêt hors ligne/)).not.toBeInTheDocument()
  })

  it('reports a version mismatch without displaying ready', async () => {
    mocks.prepareOffline.mockResolvedValue(status({ version: 'build-old', ready: false }))

    render(<OfflineStatusIndicator />)

    expect(await screen.findByText('Mise à jour de l’application requise')).toBeVisible()
    expect(screen.queryByText(/Prêt hors ligne/)).not.toBeInTheDocument()
  })

  it('retries a failed preparation and becomes ready', async () => {
    mocks.prepareOffline
      .mockResolvedValueOnce(status({ ready: false, routes: { ...routes, '/': false } }))
      .mockResolvedValueOnce(status())

    render(<OfflineStatusIndicator />)
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('En ligne — Prêt hors ligne')).toBeVisible()
    expect(mocks.prepareOffline).toHaveBeenCalledTimes(2)
  })

  it('keeps a prepared shell available when the Supabase session is expired', async () => {
    authState = { ...authState, status: 'expired', isOnlineAuthenticated: false }
    mocks.getOfflineStatus.mockResolvedValue(status())

    render(<OfflineStatusIndicator />)

    expect(await screen.findByText(/Prêt hors ligne/)).toBeVisible()
    expect(mocks.prepareOffline).not.toHaveBeenCalled()
  })

  it('renders no readiness promise for an unauthenticated user', async () => {
    authState = { status: 'unauthenticated', user: null, isOnlineAuthenticated: false, logout: vi.fn(), updateDisplayName: vi.fn() }

    const view = render(<OfflineStatusIndicator />)

    expect(view.container).toBeEmptyDOMElement()
    await waitFor(() => expect(mocks.getOfflineStatus).not.toHaveBeenCalled())
    expect(mocks.prepareOffline).not.toHaveBeenCalled()
  })
})
