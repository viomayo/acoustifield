import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'server_config_missing' }, { status: 500 })
  }

  let body: { code?: unknown; codeVerifier?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code : null
  const codeVerifier = typeof body.codeVerifier === 'string' ? body.codeVerifier : null
  if (!code || !codeVerifier) {
    return NextResponse.json({ error: 'missing_code_or_verifier' }, { status: 400 })
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
  })

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorPayload = (payload as { error_description?: string; msg?: string } | null) ?? null
    const description = errorPayload?.error_description ?? errorPayload?.msg ?? 'exchange_failed'
    return NextResponse.json(
      { error: 'exchange_failed', description, status: response.status },
      { status: response.status },
    )
  }

  return NextResponse.json({ session: payload })
}
