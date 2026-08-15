import { beforeEach, describe, expect, it, vi } from 'vitest'

const createSupabaseClient = vi.fn()

vi.mock('@supabase/supabase-js', () => ({ createClient: createSupabaseClient }))

describe('Supabase browser client', () => {
  beforeEach(() => {
    vi.resetModules()
    createSupabaseClient.mockReset().mockReturnValue({ auth: {} })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
  })

  it('keeps the PKCE verifier and session in the same persistent browser storage', async () => {
    const { createClient } = await import('./client')

    const first = createClient()
    const second = createClient()

    expect(second).toBe(first)
    expect(createSupabaseClient).toHaveBeenCalledOnce()
    expect(createSupabaseClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'publishable-key',
      {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'acoustifield-auth',
          storage: window.localStorage,
        },
      },
    )
  })
})
