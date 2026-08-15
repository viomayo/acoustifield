import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_ERROR_PATH,
  completeOAuthExchange,
  destinationAfterCodeExchange,
  errorDestination,
  readCodeVerifier,
} from './callback-flow'

const { setSession } = vi.hoisted(() => ({ setSession: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { setSession } }),
  SUPABASE_AUTH_STORAGE_KEY: 'chiroptere-auth',
}))

describe('OAuth callback flow', () => {
  it('opens the app only after the browser persisted the exchanged session', async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null })

    await expect(destinationAfterCodeExchange('oauth-code', exchange)).resolves.toBe('/')
    expect(exchange).toHaveBeenCalledWith('oauth-code')
  })

  it('redirects to the error page when the code is missing or rejected', async () => {
    const exchange = vi.fn().mockResolvedValue({ error: new Error('invalid code') })

    await expect(destinationAfterCodeExchange(null, exchange)).resolves.toBe(AUTH_ERROR_PATH)
    expect(exchange).not.toHaveBeenCalled()
    await expect(destinationAfterCodeExchange('bad-code', exchange)).resolves.toBe(AUTH_ERROR_PATH)
  })
})

describe('errorDestination', () => {
  it('builds an error-page URL with the encoded description', () => {
    const url = errorDestination('invalid_grant: code already used')

    expect(url.startsWith(`${AUTH_ERROR_PATH}?error=oauth&description=`)).toBe(true)
    expect(url).toContain(encodeURIComponent('invalid_grant: code already used'))
  })
})

describe('readCodeVerifier', () => {
  beforeEach(() => window.localStorage.clear())

  it('reads the PKCE verifier stored by supabase-js as JSON', () => {
    window.localStorage.setItem('chiroptere-auth-code-verifier', JSON.stringify('secret-verifier'))
    expect(readCodeVerifier()).toBe('secret-verifier')
  })

  it('falls back to a legacy raw verifier', () => {
    window.localStorage.setItem('chiroptere-auth-code-verifier', 'secret-verifier')
    expect(readCodeVerifier()).toBe('secret-verifier')
  })

  it('returns null when no verifier is stored', () => {
    expect(readCodeVerifier()).toBeNull()
  })
})

describe('completeOAuthExchange', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setSession.mockReset()
  })

  it('exchanges the code through the server and persists the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session: { access_token: 'at', refresh_token: 'rt' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    setSession.mockResolvedValue({ error: null })

    const { error } = await completeOAuthExchange('code-123', 'verifier-456')

    expect(error).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'code-123', codeVerifier: 'verifier-456' }),
    })
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: 'rt',
    })
  })

  it('reports the missing verifier without calling the server', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { error } = await completeOAuthExchange('code-123', null)

    expect(error).toBeInstanceOf(Error)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports the error when the server rejects the exchange', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'invalid grant' } }),
    }))

    const { error } = await completeOAuthExchange('code-123', 'verifier-456')

    expect(error).toBeInstanceOf(Error)
    expect(setSession).not.toHaveBeenCalled()
  })

  it('retries once on a network failure and reports the network error', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'))
      .mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'))
    vi.stubGlobal('fetch', fetchMock)

    const { error } = await completeOAuthExchange('code-123', 'verifier-456')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      message: 'oauth_network_error: NetworkError when attempting to fetch resource.',
    })
    expect(setSession).not.toHaveBeenCalled()
  })

  it('succeeds when the network retry succeeds', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session: { access_token: 'at', refresh_token: 'rt' },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)
    setSession.mockResolvedValue({ error: null })

    const { error } = await completeOAuthExchange('code-123', 'verifier-456')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(error).toBeNull()
    expect(setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' })
  })

  it('forwards a session persistence failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ session: { access_token: 'at', refresh_token: 'rt' } }),
    }))
    setSession.mockResolvedValue({ error: new Error('storage blocked') })

    const { error } = await completeOAuthExchange('code-123', 'verifier-456')

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ message: 'storage blocked' })
  })
})
