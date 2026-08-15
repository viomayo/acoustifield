import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Les routes terrain servent des shells statiques publics. Leur accès aux
// données est verrouillé côté client par OfflineAuthProvider, puis côté
// Supabase par la session et les politiques RLS.
export function proxy(request: NextRequest) {
  void request
  return NextResponse.next()
}

// Le callback OAuth reste un flux serveur en ligne. Le Proxy n'intervient plus
// sur les shells terrain et ne tente plus d'y reconstruire une identité.
export const config = {
  matcher: ['/auth/:path*'],
}
