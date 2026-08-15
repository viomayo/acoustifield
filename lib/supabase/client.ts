import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_AUTH_STORAGE_KEY = 'acoustifield-auth'

let browserClient: SupabaseClient | null = null

export function createClient() {
  if (!browserClient) {
    browserClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: SUPABASE_AUTH_STORAGE_KEY,
          storage: typeof window === 'undefined' ? undefined : window.localStorage,
        },
      },
    )
  }
  return browserClient
}
