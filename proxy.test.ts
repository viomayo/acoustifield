import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from './proxy'

describe('Proxy routing', () => {
  it.each(['/', '/site', '/points', '/compteur'])(
    'does not intercept the static field shell %s, with or without a session cookie',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false)
      expect(unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url,
        cookies: { 'sb-test-auth-token': 'expired-or-unverifiable' },
      })).toBe(false)
    }
  )

  it('keeps the OAuth callback on its server path without redirecting it', () => {
    const url = '/auth/callback?code=test'
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true)

    const response = proxy(new NextRequest(`https://example.test${url}`))
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not inject legacy identity headers', () => {
    const response = proxy(new NextRequest('https://example.test/auth/callback'))
    expect(response.headers.get('x-user-id')).toBeNull()
    expect(response.headers.get('x-user-name')).toBeNull()
    expect(response.headers.get('x-user-avatar')).toBeNull()
    expect(response.headers.get('x-user-is-supervisor')).toBeNull()
  })
})
