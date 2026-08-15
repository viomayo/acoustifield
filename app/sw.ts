import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'
import {
  TERRAIN_SHELL_ROUTES,
  canonicalTerrainShellPath,
  createOfflineStatus,
  resolveTerrainShell,
} from '@/lib/offline/readiness'
import {
  SUPABASE_NETWORK_ONLY_METHODS,
  cleanupLegacyPageCaches,
  isSameOriginDocumentOrRsc,
  matchesConfiguredOrigin,
  strictRulesBeforeFallback,
} from '@/lib/offline/cache-policy'

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const manifest = self.__SW_MANIFEST ?? []

function manifestEntryFor(route: string): PrecacheEntry | undefined {
  return manifest.find((entry): entry is PrecacheEntry => (
    typeof entry !== 'string' && entry.url === route
  ))
}

const shellRevisions = TERRAIN_SHELL_ROUTES.map((route) => manifestEntryFor(route)?.revision)
const shellVersion = shellRevisions.every((revision) => (
  typeof revision === 'string' && revision === shellRevisions[0]
)) ? shellRevisions[0] as string : 'invalid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null

const supabaseNetworkOnly: RuntimeCaching[] = SUPABASE_NETWORK_ONLY_METHODS.map((method) => ({
  matcher: ({ url }) => matchesConfiguredOrigin(url.origin, supabaseOrigin),
  method,
  handler: new NetworkOnly(),
}))

const terrainNavigation: RuntimeCaching = {
  matcher: ({ request, sameOrigin, url }) => (
    sameOrigin &&
    request.mode === 'navigate' &&
    canonicalTerrainShellPath(url.href) !== null
  ),
  handler: async ({ url }) => (
    await resolveTerrainShell(url.href, (route) => serwist.matchPrecache(route)) ?? Response.error()
  ),
}

const documentAndRscNetworkOnly: RuntimeCaching = {
  matcher: ({ request, sameOrigin }) => isSameOriginDocumentOrRsc(
    sameOrigin,
    request.mode,
    request.headers.get('RSC'),
  ),
  handler: new NetworkOnly(),
}

const remainingRequestsNetworkOnly: RuntimeCaching = {
  matcher: /.*/i,
  method: 'GET',
  handler: new NetworkOnly(),
}

const serwist = new Serwist({
  precacheEntries: manifest,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: strictRulesBeforeFallback(
    [terrainNavigation, ...supabaseNetworkOnly, documentAndRscNetworkOnly],
    remainingRequestsNetworkOnly,
  ),
})

async function offlineStatus(expectedVersion: string) {
  const availability = Object.fromEntries(await Promise.all(
    TERRAIN_SHELL_ROUTES.map(async (route) => [route, Boolean(await serwist.matchPrecache(route))]),
  ))
  return createOfflineStatus(expectedVersion, shellVersion, availability)
}

type StatusMessageEvent = {
  data?: { type?: string; expectedVersion?: string }
  ports: readonly MessagePort[]
  source?: { postMessage(message: unknown): void } | null
  waitUntil(promise: Promise<unknown>): void
}

const serviceWorker = self as unknown as {
  addEventListener(type: 'message', listener: (event: StatusMessageEvent) => void): void
}

const serviceWorkerLifecycle = self as unknown as {
  addEventListener(type: 'activate', listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void): void
}

serviceWorkerLifecycle.addEventListener('activate', (event) => {
  event.waitUntil(cleanupLegacyPageCaches(caches))
})

serviceWorker.addEventListener('message', (event) => {
  if (event.data?.type === 'SW_PING') {
    const pong = { type: 'SW_PONG', active: true }
    if (event.ports[0]) event.ports[0].postMessage(pong)
    else event.source?.postMessage(pong)
    return
  }
  if (event.data?.type !== 'OFFLINE_STATUS' && event.data?.type !== 'PREPARE_OFFLINE') return

  const response = offlineStatus(event.data.expectedVersion ?? 'invalid')
  event.waitUntil(response)
  void response.then((status) => {
    if (event.ports[0]) event.ports[0].postMessage(status)
    else event.source?.postMessage(status)
  })
})

serwist.addEventListeners()
