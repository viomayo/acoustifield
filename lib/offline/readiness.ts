export const TERRAIN_SHELL_ROUTES = ['/', '/recapitulatif'] as const
export const CURRENT_SHELL_VERSION = process.env.NEXT_PUBLIC_OFFLINE_SHELL_VERSION ?? 'invalid'

export type TerrainShellRoute = typeof TERRAIN_SHELL_ROUTES[number]

export interface OfflineStatus {
  version: string
  ready: boolean
  routes: Record<TerrainShellRoute, boolean>
}

export function canonicalTerrainShellPath(input: string): TerrainShellRoute | null {
  const pathname = new URL(input, 'https://offline.local').pathname
  return TERRAIN_SHELL_ROUTES.find((route) => route === pathname) ?? null
}

export async function resolveTerrainShell<T>(
  input: string,
  match: (route: TerrainShellRoute) => Promise<T | undefined>,
): Promise<T | undefined> {
  const route = canonicalTerrainShellPath(input)
  return route ? match(route) : undefined
}

export function createOfflineStatus(
  expectedVersion: string,
  cachedVersion: string,
  availability: Partial<Record<TerrainShellRoute, boolean>>,
): OfflineStatus {
  const routes = Object.fromEntries(TERRAIN_SHELL_ROUTES.map((route) => [
    route,
    availability[route] === true,
  ])) as Record<TerrainShellRoute, boolean>

  return {
    version: cachedVersion,
    ready: expectedVersion !== 'invalid' &&
      cachedVersion === expectedVersion &&
      TERRAIN_SHELL_ROUTES.every((route) => routes[route]),
    routes,
  }
}

async function requestStatus(type: 'OFFLINE_STATUS' | 'PREPARE_OFFLINE'): Promise<OfflineStatus> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service Worker indisponible')
  }

  await navigator.serviceWorker.ready
  const worker = navigator.serviceWorker.controller ?? await new Promise<ServiceWorker>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      reject(new Error('Aucun Service Worker contrôleur'))
    }, 5_000)
    const onControllerChange = () => {
      const controller = navigator.serviceWorker.controller
      if (!controller) return
      window.clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      resolve(controller)
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
  })

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => reject(new Error('Délai du Service Worker dépassé')), 5_000)
    channel.port1.onmessage = (event: MessageEvent<OfflineStatus>) => {
      window.clearTimeout(timeout)
      resolve(event.data)
    }
    worker.postMessage({ type, expectedVersion: CURRENT_SHELL_VERSION }, [channel.port2])
  })
}

export function getOfflineStatus(): Promise<OfflineStatus> {
  return requestStatus('OFFLINE_STATUS')
}

// L'installation Serwist prépare déjà atomiquement le précache. Cette commande
// ne télécharge rien une seconde fois : elle vérifie la version active.
export function prepareOffline(): Promise<OfflineStatus> {
  return requestStatus('PREPARE_OFFLINE')
}
