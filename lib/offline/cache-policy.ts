export const LEGACY_PAGE_CACHE_NAMES = [
  'pages-navigate',
  'pages-rsc',
  'pages-rsc-prefetch',
  'pages',
] as const

export const SUPABASE_NETWORK_ONLY_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const legacyPageCacheNames = new Set<string>(LEGACY_PAGE_CACHE_NAMES)

export function strictRulesBeforeFallback<T>(
  strictRules: readonly T[],
  fallbackRule: T,
): T[] {
  return [...strictRules, fallbackRule]
}

export function matchesConfiguredOrigin(requestOrigin: string, configuredOrigin: string | null): boolean {
  return configuredOrigin !== null && requestOrigin === configuredOrigin
}

export function isSameOriginDocumentOrRsc(
  sameOrigin: boolean,
  requestMode: string,
  rscHeader: string | null,
): boolean {
  return sameOrigin && (requestMode === 'navigate' || rscHeader === '1')
}

export async function cleanupLegacyPageCaches(storage: Pick<CacheStorage, 'keys' | 'delete'>): Promise<string[]> {
  const existing = await storage.keys()
  const targets = existing.filter((cacheName) => legacyPageCacheNames.has(cacheName))
  await Promise.all(targets.map((cacheName) => storage.delete(cacheName)))
  return targets
}
