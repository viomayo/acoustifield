export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
}

export function isValidLon(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180
}

function degreesFromDms(value: number, sign: 1 | -1): number {
  return value * sign
}

function parseDmsPart(tokens: string[]): { value: number; consumed: number } | null {
  if (tokens.length < 3) return null
  const deg = Number(tokens[0])
  const min = Number(tokens[1])
  const secText = tokens[2]
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null
  if (/^\d/.test(secText) && !/^[NSEOWnseow]/.test(secText)) {
    const sec = Number(secText)
    if (!Number.isFinite(sec)) return null
    return { value: deg + min / 60 + sec / 3600, consumed: 3 }
  }
  return { value: deg + min / 60, consumed: 2 }
}

function parseDms(input: string): { lat: number; lon: number } | null {
  const clean = input.trim().replace(/,/g, ' ')
  const tokens = clean.split(/\s+/).filter(Boolean)
  let lat: number | null = null
  let lon: number | null = null
  let i = 0
  let current = 0
  let sign: 1 | -1 = 1

  const axisMap = new Map<string, 'lat' | 'lon'>([
    ['N', 'lat'], ['n', 'lat'], ['S', 'lat'], ['s', 'lat'],
    ['E', 'lon'], ['e', 'lon'], ['W', 'lon'], ['w', 'lon'],
  ])

  while (i < tokens.length) {
    const token = tokens[i]
    const axis = axisMap.get(token)
    if (axis) {
      const value = degreesFromDms(current, sign)
      if (axis === 'lat') lat = value
      else lon = value
      current = 0
      sign = 1
      i++
      continue
    }
    if (/^[NSns]/.test(token) && !/^\d/.test(token)) {
      sign = token === 'S' || token === 's' ? -1 : 1
      i++
      continue
    }
    if (/^[EWew]/.test(token) && !/^\d/.test(token)) {
      const value = degreesFromDms(current, sign)
      if (lon === null) lon = value
      current = 0
      sign = 1
      i++
      continue
    }
    const remainder = tokens.slice(i)
    const dms = parseDmsPart(remainder)
    if (!dms) break
    current += dms.value
    i += dms.consumed
    const tail = remainder[dms.consumed]
    if (tail && axisMap.has(tail)) {
      // handled on next iteration
    }
  }
  if (lat === null || lon === null) return null
  if (!isValidLat(lat) || !isValidLon(lon)) return null
  return { lat, lon }
}

export function parseWgs84(input: string): { lat: number; lon: number } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const numeric = trimmed.split(/[\s,;]+/).map(Number).filter(Number.isFinite)
  if (numeric.length >= 2 && numeric.every((n) => Math.abs(n) <= 180)) {
    const [a, b] = numeric
    if (isValidLat(a) && isValidLon(b)) return { lat: a, lon: b }
    if (isValidLat(b) && isValidLon(a)) return { lat: b, lon: a }
  }

  const dms = parseDms(trimmed)
  if (dms) return dms

  return null
}

export interface ReverseGeocodeResult {
  commune: string
  displayName: string
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lon))
    url.searchParams.set('accept-language', 'fr')
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const json = (await response.json()) as { address?: Record<string, string>; display_name?: string }
    const address = json.address ?? {}
    const commune =
      address.city || address.town || address.village || address.municipality || address.county || ''
    if (!commune && !json.display_name) return null
    return { commune, displayName: json.display_name ?? '' }
  } catch {
    return null
  }
}
