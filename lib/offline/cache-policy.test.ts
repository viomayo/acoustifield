import { describe, expect, it, vi } from 'vitest'
import {
  SUPABASE_NETWORK_ONLY_METHODS,
  cleanupLegacyPageCaches,
  isSameOriginDocumentOrRsc,
  matchesConfiguredOrigin,
  strictRulesBeforeFallback,
} from './cache-policy'

function rule(cacheName?: string) {
  return { handler: cacheName ? { cacheName } : {} }
}

describe('Service Worker cache policy', () => {
  it('keeps strict rules before generic defaults', () => {
    const terrain = rule('terrain-precache')
    const supabase = rule()
    const pageNetworkOnly = rule()
    const generic = rule()

    expect(strictRulesBeforeFallback(
      [terrain, supabase, pageNetworkOnly],
      generic,
    )).toEqual([terrain, supabase, pageNetworkOnly, generic])
  })

  it('matches every path on the configured Supabase origin only', () => {
    const origin = 'https://project.supabase.co'
    expect(matchesConfiguredOrigin(new URL(`${origin}/auth/v1/user`).origin, origin)).toBe(true)
    expect(matchesConfiguredOrigin(new URL(`${origin}/rest/v1/sessions`).origin, origin)).toBe(true)
    expect(matchesConfiguredOrigin(new URL(`${origin}/rest/v1/rpc/sync_session_snapshot`).origin, origin)).toBe(true)
    expect(matchesConfiguredOrigin('https://other.example', origin)).toBe(false)
    expect(matchesConfiguredOrigin(origin, null)).toBe(false)
    expect(SUPABASE_NETWORK_ONLY_METHODS).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  })

  it('routes same-origin navigations and RSC payloads to NetworkOnly', () => {
    expect(isSameOriginDocumentOrRsc(true, 'navigate', null)).toBe(true)
    expect(isSameOriginDocumentOrRsc(true, 'cors', '1')).toBe(true)
    expect(isSameOriginDocumentOrRsc(true, 'cors', null)).toBe(false)
    expect(isSameOriginDocumentOrRsc(false, 'navigate', null)).toBe(false)
  })

  it('deletes only application legacy page caches during activation', async () => {
    const remove = vi.fn().mockResolvedValue(true)
    const storage = {
      keys: vi.fn().mockResolvedValue(['pages-navigate', 'pages-rsc', 'pages', 'static-image-assets', 'other-app']),
      delete: remove,
    }

    expect(await cleanupLegacyPageCaches(storage)).toEqual(['pages-navigate', 'pages-rsc', 'pages'])
    expect(remove.mock.calls.map(([name]) => name)).toEqual(['pages-navigate', 'pages-rsc', 'pages'])
  })
})
