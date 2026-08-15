import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SyncButton from './sync-button'

const mocks = vi.hoisted(() => ({
  syncAll: vi.fn(),
  pullMyFiches: vi.fn(),
}))

vi.mock('@/lib/supabase/sync', () => ({
  syncAll: mocks.syncAll,
  pullMyFiches: mocks.pullMyFiches,
}))
vi.mock('./conflict-modal', () => ({ default: () => <div>Conflit</div> }))
vi.mock('lucide-react', () => ({ RefreshCw: () => <span aria-hidden="true">↻</span> }))

const pushResult = { synced: 0, deleted: 0, errors: 0, conflicts: [], failures: [] }
const pullResult = { imported: 0, merged: 0, errors: 0, conflicts: [], failures: [] }

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

describe('SyncButton triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setOnline(true)
    mocks.syncAll.mockResolvedValue(pushResult)
    mocks.pullMyFiches.mockResolvedValue(pullResult)
  })
  afterEach(cleanup)

  it('waits for a remotely authenticated owner, then syncs once at online startup', async () => {
    const view = render(<SyncButton userId={null} />)
    expect(mocks.syncAll).not.toHaveBeenCalled()

    view.rerender(<SyncButton userId="user-a" />)
    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledOnce())
    expect(mocks.syncAll).toHaveBeenCalledWith('user-a')
  })

  it('does not sync an offline or expired local identity represented by no remote owner', async () => {
    render(<SyncButton userId={null} />)
    window.dispatchEvent(new Event('online'))

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(mocks.syncAll).not.toHaveBeenCalled()
  })

  it('waits for auth confirmation after network return and syncs only once', async () => {
    setOnline(false)
    const view = render(<SyncButton userId={null} />)

    setOnline(true)
    window.dispatchEvent(new Event('online'))
    expect(mocks.syncAll).not.toHaveBeenCalled()

    view.rerender(<SyncButton userId="user-a" />)
    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledOnce())
  })

  it('allows a manual sync for a remotely authenticated owner', async () => {
    setOnline(false)
    render(<SyncButton userId="user-a" />)

    fireEvent.click(screen.getByRole('button', { name: /Sync/ }))
    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledOnce())
  })

  it('deduplicates startup, online and manual triggers while a sync is active', async () => {
    let finish!: (value: typeof pushResult) => void
    mocks.syncAll.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<SyncButton userId="user-a" />)

    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledOnce())
    window.dispatchEvent(new Event('online'))
    fireEvent.click(screen.getByRole('button', { name: /Sync/ }))
    expect(mocks.syncAll).toHaveBeenCalledOnce()

    finish(pushResult)
    await waitFor(() => expect(mocks.pullMyFiches).toHaveBeenCalledOnce())
  })

  it('allows another manual sync after the previous one completes', async () => {
    render(<SyncButton userId="user-a" />)
    await waitFor(() => expect(mocks.pullMyFiches).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: /Sync/ }))
    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledTimes(2))
  })

  it('allows a retry after an automatic sync throws', async () => {
    mocks.syncAll.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(pushResult)
    render(<SyncButton userId="user-a" />)

    await screen.findByRole('button', { name: /Sync/ })
    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: /Sync/ }))

    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledTimes(2))
    expect(mocks.pullMyFiches).toHaveBeenCalledOnce()
  })
})
