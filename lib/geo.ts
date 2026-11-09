export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
}

export function isValidLon(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180
}

const COORD_TOKEN_RE =
  /([+-]?\d+(?:[.,]\d+)?)\s*(?:°\s*)?(?:\s*(\d+(?:[.,]\d+)?)\s*['′’]\s*)?(?:\s*(\d+(?:[.,]\d+)?)\s*(?:["″”]))?\s*([NSEWnsew])?/g

function coordValue(match: RegExpMatchArray): number {
  const deg = Number(match[1].replace(',', '.'))
  const min = match[2] ? Number(match[2].replace(',', '.')) : 0
  const sec = match[3] ? Number(match[3].replace(',', '.')) : 0
  return deg + min / 60 + sec / 3600
}

function applyDirection(value: number, dir?: string): number {
  if (!dir) return value
  if (dir === 'N' || dir === 'E') return Math.abs(value)
  if (dir === 'S' || dir === 'W') return -Math.abs(value)
  return value
}

export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const text = input.trim()
  if (!text) return null

  const matches = Array.from(text.matchAll(COORD_TOKEN_RE)).filter((m) => m[1] !== undefined)
  if (matches.length !== 2) return null

  const first = matches[0]
  const second = matches[1]
  const dir0 = first[4] ? first[4].toUpperCase() : undefined
  const dir1 = second[4] ? second[4].toUpperCase() : undefined
  const hasLatDir = dir0 === 'N' || dir0 === 'S' || dir1 === 'N' || dir1 === 'S'
  const hasLonDir = dir0 === 'E' || dir0 === 'W' || dir1 === 'E' || dir1 === 'W'

  let lat: number
  let lon: number
  if (hasLatDir && hasLonDir) {
    const latMatch = dir0 === 'N' || dir0 === 'S' ? first : second
    const lonMatch = dir0 === 'E' || dir0 === 'W' ? first : second
    lat = applyDirection(coordValue(latMatch), latMatch[4])
    lon = applyDirection(coordValue(lonMatch), lonMatch[4])
  } else {
    lat = applyDirection(coordValue(first), dir0)
    lon = applyDirection(coordValue(second), dir1)
  }

  if (!isValidLat(lat) || !isValidLon(lon)) return null
  return { lat, lon }
}

export function parseWgs84(input: string): { lat: number; lon: number } | null {
  return parseCoordinates(input)
}

export interface ReverseGeocodeResult {
  commune: string
  displayName: string
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function reverseGeocodeNominatim(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('accept-language', 'fr')
  const response = await fetchWithTimeout(url.toString())
  if (!response.ok) return null
  const json = (await response.json()) as { address?: Record<string, string>; display_name?: string }
  const address = json.address ?? {}
  const commune = address.city || address.town || address.village || address.hamlet || address.municipality || address.county || ''
  if (!commune && !json.display_name) return null
  return { commune, displayName: json.display_name ?? '' }
}

async function reverseGeocodeBigDataCloud(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('localityLanguage', 'fr')
  const response = await fetchWithTimeout(url.toString())
  if (!response.ok) return null
  const json = (await response.json()) as { city?: string; locality?: string; principalSubdivision?: string; longitude?: number; latitude?: number }
  const commune = json.city || json.locality || json.principalSubdivision || ''
  if (!commune && json.longitude === undefined) return null
  return { commune, displayName: commune }
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  let nominatim: ReverseGeocodeResult | null = null
  try {
    nominatim = await reverseGeocodeNominatim(lat, lon)
  } catch {
    nominatim = null
  }
  if (nominatim?.commune) return nominatim
  try {
    const bigDataCloud = await reverseGeocodeBigDataCloud(lat, lon)
    if (bigDataCloud?.commune) return bigDataCloud
    return nominatim ?? bigDataCloud
  } catch {
    return nominatim
  }
}
