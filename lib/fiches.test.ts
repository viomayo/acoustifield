import { describe, expect, it } from 'vitest'
import { parseCoordinates } from './fiches'

describe('parseCoordinates', () => {
  it('parses plain decimal coordinates separated by a comma', () => {
    expect(parseCoordinates('50.72521, 4.53803')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('parses decimal coordinates with a French comma separator', () => {
    expect(parseCoordinates('50,72521 4,53803')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('parses decimal coordinates with degree signs and cardinal directions', () => {
    expect(parseCoordinates('50,72521° N, 4,53803° E')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('parses DMS coordinates with cardinal directions', () => {
    const result = parseCoordinates("50°53'19,7\"N 4°21'50,3\"E")
    expect(result).not.toBeNull()
    expect(result!.lat).toBeCloseTo(50.888806, 5)
    expect(result!.lon).toBeCloseTo(4.363972, 5)
  })

  it('assigns axes by cardinal direction even when longitude comes first', () => {
    const result = parseCoordinates('4,53803° E, 50,72521° N')
    expect(result).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('applies a negative sign for S and W directions', () => {
    expect(parseCoordinates('51.5 S 0.1 W')).toEqual({ lat: -51.5, lon: -0.1 })
  })

  it('parses a single decimal with space separator', () => {
    expect(parseCoordinates('50.72521 4.53803')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('returns null for empty or invalid input', () => {
    expect(parseCoordinates('')).toBeNull()
    expect(parseCoordinates('   ')).toBeNull()
    expect(parseCoordinates('abc')).toBeNull()
    expect(parseCoordinates('50.72521')).toBeNull()
    expect(parseCoordinates('1 2 3')).toBeNull()
  })
})
