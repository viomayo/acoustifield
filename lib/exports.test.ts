import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import {
  buildPhotosZip,
  csvCell,
  downloadBlob,
  downloadText,
  ficheToCSV,
  ficheToJSON,
  slugify,
  stripAccents,
} from './exports'
import { makeFiche, makePhoto } from './test-fixtures'

function parseCsvRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ';' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

describe('exports', () => {
  it('strips accents from text', () => {
    expect(stripAccents('Étang de la Hulotte')).toBe('Etang de la Hulotte')
  })

  it('quotes CSV cells containing separators, quotes or newlines', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('multi\nline')).toBe('"multi\nline"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(0)).toBe('0')
  })

  it('slugifies a site name into a file-safe string', () => {
    expect(slugify('Étang de la Hulotte!')).toBe('etang-de-la-hulotte-')
    expect(slugify('  Site   étonnant  ')).toBe('site-etonnant')
  })

  it('builds an Excel-friendly CSV with BOM, semicolons and metadata', () => {
    const csv = ficheToCSV(makeFiche(), 2, { id: 'user-b', name: 'Bob' })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const [header, row] = csv.slice(1).split('\r\n')
    const columns = header.split(';')
    const cells = row.split(';')
    const at = (name: string) => columns.indexOf(name)

    expect(columns).toContain('user_id')
    expect(cells[at('fiche_id')]).toBe('fiche-1')
    expect(cells[at('user_id')]).toBe('user-b')
    expect(cells[at('user_name')]).toBe('Bob')
    expect(cells[at('date_debut_nuit')]).toBe('2026-08-14')
    expect(cells[at('conditions_meteo')]).toBe('Pluie|Vent')
    expect(cells[at('carte_sd_pleine')]).toBe('0')
    expect(cells[at('nb_photos')]).toBe('2')
    expect(cells[at('mis_a_jour_le')]).toBe('2026-08-14T21:00:00.000Z')
  })

  it('escapes comment cells and flags a full SD card', () => {
    const csv = ficheToCSV(makeFiche({ carteSdPleine: true, commentaires: 'a;b' }), 1)
    const [headerLine, rowLine] = csv.slice(1).split('\r\n')
    const cells = parseCsvRow(rowLine)
    const columns = headerLine.split(';')
    expect(cells[columns.indexOf('carte_sd_pleine')]).toBe('1')
    expect(cells[columns.indexOf('commentaires')]).toBe('a;b')
  })

  it('serialises a fiche and its photos to JSON', () => {
    const json = ficheToJSON(makeFiche(), [makePhoto({ storagePath: 'user-a/fiche-1/0-photo-1.jpg' })])
    const parsed = JSON.parse(json) as {
      app: string
      exportedAt: string
      fiche: { id: string }
      photos: Array<{ id: string; mimeType: string; storagePath: string | null }>
    }
    expect(parsed.app).toBe('AcoustiField')
    expect(parsed.fiche.id).toBe('fiche-1')
    expect(parsed.exportedAt).toEqual(expect.any(String))
    expect(parsed.photos).toEqual([
      { id: 'photo-1', mimeType: 'image/jpeg', storagePath: 'user-a/fiche-1/0-photo-1.jpg' },
    ])
  })

  it('bundles the photos of a fiche into a zip', async () => {
    const blob = await buildPhotosZip(makeFiche({ siteNom: 'Étang de la Hulotte' }), [
      makePhoto({ position: 0 }),
      makePhoto({ id: 'photo-2', position: 1 }),
    ])
    const zip = await JSZip.loadAsync(blob)
    const files = Object.keys(zip.files).filter((name) => !name.endsWith('/')).sort()
    expect(files).toEqual([
      'fiche-1/00-Etang-de-la-Hulotte.jpg',
      'fiche-1/01-Etang-de-la-Hulotte.jpg',
    ])
  })

  it('downloads text and blobs through a temporary object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadText('content', 'file.txt', 'text/plain')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')

    click.mockClear()
    downloadBlob(new Blob(['x']), 'file.bin')
    expect(click).toHaveBeenCalledOnce()
  })
})
