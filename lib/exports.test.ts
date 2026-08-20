import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import {
  buildPhotosZip,
  buildPhotosZipAll,
  buildProjectCsvZip,
  csvCell,
  decimalCell,
  downloadBlob,
  downloadCSV,
  downloadText,
  encodeWindows1252,
  exportBasename,
  ficheToCSV,
  ficheToJSON,
  fichesToCSV,
  fichesToJSON,
  photoFileName,
  slugify,
  stripAccents,
  WINDOWS_1252_HIGH,
} from './exports'
import { makeFiche, makePhoto } from './test-fixtures'

const WINDOWS_1252_BYTE_TO_CHAR = new Map(
  Object.entries(WINDOWS_1252_HIGH).map(([char, byte]) => [byte, char])
)

function decodeWindows1252(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) {
    if (byte < 0x80 || byte >= 0xa0) {
      out += String.fromCharCode(byte)
    } else {
      out += WINDOWS_1252_BYTE_TO_CHAR.get(byte) ?? ''
    }
  }
  return out
}

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

  it('builds an Excel-friendly CSV with semicolons and metadata', () => {
    const csv = ficheToCSV(makeFiche(), 2, { id: 'user-b', name: 'Bob' })
    expect(csv.startsWith('\uFEFF')).toBe(false)
    const [header, row] = csv.split('\r\n')
    const columns = header.split(';')
    const cells = row.split(';')
    const at = (name: string) => columns.indexOf(name)

    expect(columns).toContain('user_id')
    expect(cells[at('fiche_id')]).toBe('fiche-1')
    expect(cells[at('user_id')]).toBe('user-b')
    expect(cells[at('user_name')]).toBe('Bob')
    expect(cells[at('date_heure_pose')]).toBe('2026-08-14T20:00')
    expect(cells[at('date_heure_recherche')]).toBe('2026-08-17T08:00')
    expect(cells[at('nb_nuits_ecoute')]).toBe('3')
    expect(cells[at('conditions_meteo')]).toBe('Pluie|Vent')
    expect(cells[at('carte_sd_pleine')]).toBe('0')
    expect(cells[at('nb_photos')]).toBe('2')
    expect(cells[at('mis_a_jour_le')]).toBe('2026-08-14T21:00:00.000Z')
  })

  it('exports decimal coordinates and measures with a comma separator', () => {
    const csv = ficheToCSV(makeFiche(), 1)
    const [header, row] = csv.split('\r\n')
    const columns = header.split(';')
    const cells = parseCsvRow(row)
    const at = (name: string) => columns.indexOf(name)
    expect(cells[at('lat')]).toBe('50,8333')
    expect(cells[at('lon')]).toBe('4,4667')
    expect(cells[at('hauteur_pose_m')]).toBe('3,5')
    expect(cells[at('temperature_c')]).toBe('18')
    expect(cells[at('orientation_deg')]).toBe('')
  })

  it('formats decimal numbers with a comma and empty values as empty cells', () => {
    expect(decimalCell(3.5)).toBe('3,5')
    expect(decimalCell(18)).toBe('18')
    expect(decimalCell(-1.25)).toBe('-1,25')
    expect(decimalCell(null)).toBe('')
    expect(decimalCell(undefined)).toBe('')
  })

  it('encodes French accents and special characters to Windows-1252 bytes', () => {
    const bytes = encodeWindows1252('Élise Météo — Étang de la Hulotte (cœur)')
    expect(bytes[0]).toBe(0xc9)
    expect(Array.from(bytes)).toContain(0x97)
    expect(Array.from(bytes)).toContain(0x9c)
    expect(decodeWindows1252(bytes)).toBe('Élise Météo — Étang de la Hulotte (cœur)')
  })

  it('replaces characters outside Windows-1252 with a question mark', () => {
    expect(Array.from(encodeWindows1252('A😀B'))).toEqual([0x41, 0x3f, 0x3f, 0x42])
  })

  it('exports a CSV that contains accented characters as UTF-8', () => {
    const csv = ficheToCSV(makeFiche({ siteNom: 'Étang de la Hulotte', operateur: 'Élise Météo' }), 1)
    expect(csv.includes('Étang')).toBe(true)
    expect(csv.includes('Élise')).toBe(true)
  })

  it('stores project CSV files in the zip as UTF-8 with BOM', async () => {
    const csv = ficheToCSV(makeFiche({ siteNom: 'Étang de la Hulotte' }), 1)
    const blob = await buildProjectCsvZip([{ projet: 'Suivi des chiroptères', csv }])
    const zip = await JSZip.loadAsync(blob)
    const inner = await zip.file('Suivi des chiroptères.csv')!.async('uint8array')
    expect(inner[0]).toBe(0xef)
    expect(inner[1]).toBe(0xbb)
    expect(inner[2]).toBe(0xbf)
    const text = await zip.file('Suivi des chiroptères.csv')!.async('string')
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(text.slice(1)).toBe(csv)
  })

  it('escapes comment cells and flags a full SD card', () => {
    const csv = ficheToCSV(makeFiche({ carteSdPleine: true, commentaires: 'a;b' }), 1)
    const [headerLine, rowLine] = csv.split('\r\n')
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
      'fiche-1/Projet A - 2026-08-14T20-00 - Étang de la Hulotte - Opérateur - 01.jpg',
      'fiche-1/Projet A - 2026-08-14T20-00 - Étang de la Hulotte - Opérateur - 02.jpg',
    ])
  })

  it('builds a photo file name from the fiche basename and a photo number', () => {
    expect(photoFileName(makeFiche({ projet: 'Projet A', siteNom: 'Étang de la Hulotte', operateur: 'Marie' }), 0)).toBe(
      'Projet A - 2026-08-14T20-00 - Étang de la Hulotte - Marie - 01.jpg',
    )
    expect(photoFileName(makeFiche(), 9)).toBe('Projet A - 2026-08-14T20-00 - Étang de la Hulotte - Opérateur - 10.jpg')
  })

  it('links the photo file names in the CSV photos column', () => {
    const csv = ficheToCSV(makeFiche(), 2, undefined, [
      'Projet A - 2026-08-14T20:00 - Étang de la Hulotte - Opérateur - 01.jpg',
      'Projet A - 2026-08-14T20:00 - Étang de la Hulotte - Opérateur - 02.jpg',
    ])
    const [header, row] = csv.split('\r\n')
    const cells = parseCsvRow(row)
    const columns = header.split(';')
    expect(columns).toContain('photos')
    expect(cells[columns.indexOf('photos')]).toBe(
      'Projet A - 2026-08-14T20:00 - Étang de la Hulotte - Opérateur - 01.jpg|Projet A - 2026-08-14T20:00 - Étang de la Hulotte - Opérateur - 02.jpg',
    )
  })

  it('creates one CSV file per project inside a zip', async () => {
    const blob = await buildProjectCsvZip([
      { projet: 'Projet A', csv: 'csv-a' },
      { projet: 'Plan B', csv: 'csv-b' },
    ])
    const zip = await JSZip.loadAsync(blob)
    const files = Object.keys(zip.files).filter((name) => !name.endsWith('/')).sort()
    expect(files).toEqual(['Plan B.csv', 'Projet A.csv'])
  })

  it('renames colliding project CSV files inside the zip', async () => {
    const blob = await buildProjectCsvZip([
      { projet: 'Projet', csv: 'csv-a' },
      { projet: 'Projet', csv: 'csv-b' },
    ])
    const zip = await JSZip.loadAsync(blob)
    const files = Object.keys(zip.files).filter((name) => !name.endsWith('/')).sort()
    expect(files).toEqual(['Projet-2.csv', 'Projet.csv'])
  })

  it('builds an export basename as Projet - Date - Site - Opérateur', () => {
    const fiche = makeFiche({ projet: 'Plan chauves-souris', siteNom: 'Étang de la Hulotte', operateur: 'Marie Dupont' })
    expect(exportBasename(fiche)).toBe('Plan chauves-souris - 2026-08-14T20-00 - Étang de la Hulotte - Marie Dupont')
    expect(exportBasename(makeFiche({ projet: '', operateur: '' }))).toBe('2026-08-14T20-00 - Étang de la Hulotte')
    expect(exportBasename(makeFiche({ projet: 'a:b/c*d', siteNom: '' }))).toBe('a-b-c-d - 2026-08-14T20-00 - Opérateur')
  })

  it('merges several fiches into a single CSV with one row per fiche', () => {
    const csv = fichesToCSV([
      { fiche: makeFiche(), photoCount: 2, userName: 'Bob' },
      { fiche: makeFiche({ id: 'fiche-2', siteNom: 'Autre site', boitierNum: 'B2' }), photoCount: 0 },
    ])
    expect(csv.startsWith('\uFEFF')).toBe(false)
    const [header, row1, row2] = csv.split('\r\n')
    const columns = header.split(';')
    const at = (name: string) => columns.indexOf(name)
    expect(row1.split(';')[at('user_name')]).toBe('Bob')
    expect(row1.split(';')[at('nb_photos')]).toBe('2')
    expect(row2.split(';')[at('fiche_id')]).toBe('fiche-2')
    expect(row2.split(';')[at('nb_photos')]).toBe('0')
  })

  it('serialises several fiches and their photos to JSON', () => {
    const json = fichesToJSON([
      { fiche: makeFiche(), photos: [makePhoto()] },
      { fiche: makeFiche({ id: 'fiche-2' }), photos: [] },
    ])
    const parsed = JSON.parse(json) as { app: string; fiches: Array<{ fiche: { id: string }; photos: unknown[] }> }
    expect(parsed.app).toBe('AcoustiField')
    expect(parsed.fiches).toHaveLength(2)
    expect(parsed.fiches[0].fiche.id).toBe('fiche-1')
    expect(parsed.fiches[0].photos).toHaveLength(1)
    expect(parsed.fiches[1].fiche.id).toBe('fiche-2')
    expect(parsed.fiches[1].photos).toHaveLength(0)
  })

  it('bundles the photos of several fiches into one zip, one folder per fiche', async () => {
    const blob = await buildPhotosZipAll([
      { fiche: makeFiche({ siteNom: 'Étang de la Hulotte' }), photos: [makePhoto({ position: 0 })] },
      { fiche: makeFiche({ id: 'fiche-2', siteNom: 'Bois du Couvent' }), photos: [makePhoto({ id: 'photo-3', position: 1 })] },
    ])
    const zip = await JSZip.loadAsync(blob)
    const files = Object.keys(zip.files).filter((name) => !name.endsWith('/')).sort()
    expect(files).toEqual([
      'fiche-1/Projet A - 2026-08-14T20-00 - Étang de la Hulotte - Opérateur - 01.jpg',
      'fiche-2/Projet A - 2026-08-14T20-00 - Bois du Couvent - Opérateur - 02.jpg',
    ])
  })

  it('skips fiches without photos when bundling the zip', async () => {
    const blob = await buildPhotosZipAll([
      { fiche: makeFiche(), photos: [makePhoto()] },
      { fiche: makeFiche({ id: 'fiche-2' }), photos: [] },
    ])
    const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files).filter((name) => !name.endsWith('/'))).toEqual([
      'fiche-1/Projet A - 2026-08-14T20-00 - Étang de la Hulotte - Opérateur - 01.jpg',
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

  it('downloads CSV content as UTF-8 with BOM', () => {
    let capturedBlob: Blob | undefined
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return 'blob:csv'
    })
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    click.mockClear()

    downloadCSV('Élise;50,8', 'fiche.csv')
    expect(capturedBlob?.type).toBe('text/csv;charset=utf-8')
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv')
  })
})
