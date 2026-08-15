import { createClient, SUPABASE_AUTH_STORAGE_KEY } from '@/lib/supabase/client'

export const AUTH_ERROR_PATH = '/auth/auth-code-error'

export function errorDestination(error: string): string {
  return `${AUTH_ERROR_PATH}?error=oauth&description=${encodeURIComponent(error.slice(0, 500))}`
}

export async function destinationAfterCodeExchange(
  code: string | null,
  exchangeCodeForSession: (code: string) => Promise<{ error: unknown }>,
): Promise<string> {
  if (!code) return AUTH_ERROR_PATH
  const { error } = await exchangeCodeForSession(code)
  return error ? AUTH_ERROR_PATH : '/'
}

export function readCodeVerifier(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(`${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return raw
  }
}

export async function completeOAuthExchange(
  code: string,
  codeVerifier: string | null,
): Promise<{ error: unknown }> {
  if (!codeVerifier) return { error: new Error('pkce_code_verifier_not_found') }

  const body = JSON.stringify({ code, codeVerifier })
  const post = () =>
    fetch('/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

  let response: Response
  try {
    response = await post()
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 800))
    try {
      response = await post()
    } catch (retryError) {
      const reason = retryError instanceof Error ? retryError.message : String(retryError)
      return { error: new Error(`oauth_network_error: ${reason}`) }
    }
  }

  const payload: unknown = await response.json().catch(() => null)
  const session = (payload as {
    session?: { access_token?: string; refresh_token?: string }
  } | null)?.session

  if (!response.ok || !session?.access_token || !session.refresh_token) {
    const description = (payload as { description?: string } | null)?.description
      ?? (payload as { error?: string } | null)?.error
      ?? 'erreur inconnue'
    return { error: new Error(`oauth_exchange_failed:${response.status}: ${description}`) }
  }

  const { error } = await createClient().auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  return { error }
}
