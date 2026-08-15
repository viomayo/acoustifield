import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppShell from './app-shell'
import type { OfflineAuthState } from './offline-auth-provider'

let authState: OfflineAuthState

vi.mock('./offline-auth-provider', () => ({
  useOfflineAuth: () => authState,
}))
vi.mock('./sync-button', () => ({ default: ({ userId }: { userId: string | null }) => <span data-testid="sync-owner">{userId ?? 'disabled'}</span> }))
vi.mock('./logout-button', () => ({ default: () => <button>Se déconnecter</button> }))
vi.mock('./sub-navbar', () => ({ default: () => <nav>Navigation terrain</nav> }))
vi.mock('./offline-status', () => ({ default: () => <span>Statut hors ligne</span> }))
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }))

const identity = { ownerId: 'user-a', displayName: 'Utilisateur A', avatarUrl: null }
const logout = vi.fn()
const updateDisplayName = vi.fn()

describe('AppShell identity gate', () => {
  afterEach(cleanup)

  it('does not render business content while identity is loading', () => {
    authState = { status: 'loading', user: null, isOnlineAuthenticated: false, logout, updateDisplayName }
    render(<AppShell><p>Données métier sensibles</p></AppShell>)

    expect(screen.getByText(/Chargement de l'identité/)).toBeVisible()
    expect(screen.queryByText('Données métier sensibles')).not.toBeInTheDocument()
  })

  it('renders local identity and business content offline without enabling sync', () => {
    authState = { status: 'offline', user: identity, isOnlineAuthenticated: false, logout, updateDisplayName }
    render(<AppShell><p>Données métier A</p></AppShell>)

    expect(screen.getByText('Utilisateur A')).toBeVisible()
    expect(screen.getByText('Données métier A')).toBeVisible()
    expect(screen.getByText(/Mode hors ligne/)).toBeVisible()
    expect(screen.getByTestId('sync-owner')).toHaveTextContent('disabled')
  })

  it('keeps local work available with an expired remote session', () => {
    authState = { status: 'expired', user: identity, isOnlineAuthenticated: false, logout, updateDisplayName }
    render(<AppShell><p>Formulaire local</p></AppShell>)

    expect(screen.getByText('Formulaire local')).toBeVisible()
    expect(screen.getByText(/Session en ligne expirée/)).toBeVisible()
    expect(screen.getByTestId('sync-owner')).toHaveTextContent('disabled')
  })

  it('locks the shell without exposing previous business content when unauthenticated', () => {
    authState = { status: 'unauthenticated', user: null, isOnlineAuthenticated: false, logout, updateDisplayName }
    render(<AppShell><p>Données métier précédentes</p></AppShell>)

    expect(screen.getByText('Application verrouillée.')).toBeVisible()
    expect(screen.queryByText('Données métier précédentes')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login')
  })
})
