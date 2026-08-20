import type { FicheData, PhotoData } from './idb'

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  return /[;",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function decimalCell(value: number | null | undefined): string {
  return value == null ? '' : String(value).replace('.', ',')
}

export const WINDOWS_1252_HIGH: Readonly<Record<string, number>> = {
  '\u20AC': 0x80, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84, '\u2026': 0x85,
  '\u2020': 0x86, '\u2021': 0x87, '\u02C6': 0x88, '\u2030': 0x89, '\u0160': 0x8A,
  '\u2039': 0x8B, '\u0152': 0x8C, '\u017D': 0x8E, '\u2018': 0x91, '\u2019': 0x92,
  '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
  '\u02DC': 0x98, '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C,
  '\u017E': 0x9E, '\u0178': 0x9F,
}

export function encodeWindows1252(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
      bytes[i] = code
    } else {
      bytes[i] = WINDOWS_1252_HIGH[text[i]] ?? 0x3f
    }
  }
  return bytes
}

const CSV_HEADER = [
  'fiche_id', 'user_id', 'user_name', 'date_heure_pose', 'date_heure_recherche', 'nb_nuits_ecoute', 'appareil_type', 'boitier_num', 'micro_num',
  'carte_sd_pleine', 'projet', 'operateur', 'site_nom', 'lat', 'lon', 'commune',
  'sur_element', 'sur_element_autre', 'ouverture_paysage', 'habitat_principal', 'habitat_secondaire',
  'habitat_principal_autre', 'habitat_secondaire_autre',
  'gestion', 'eclairage', 'hauteur_pose_m', 'orientation_deg', 'temperature_c', 'type_nuit', 'conditions_meteo',
  'commentaires', 'nb_photos', 'photos', 'cree_le', 'mis_a_jour_le',
]

type CsvUser = { id?: string | null; name?: string | null }

function csvRow(fiche: FicheData, photoCount: number, user?: CsvUser, photoNames: string[] = []): (string | number | null)[] {
  return [
    fiche.id,
    user?.id ?? fiche.ownerId,
    user?.name ?? '',
    fiche.dateHeurePose,
    fiche.dateHeureRecherche,
    fiche.nbNuitsEcoute != null ? String(fiche.nbNuitsEcoute) : '',
    fiche.appareilType,
    fiche.boitierNum,
    fiche.microNum,
    fiche.carteSdPleine ? '1' : '0',
    fiche.projet,
    fiche.operateur,
    fiche.siteNom,
    decimalCell(fiche.lat),
    decimalCell(fiche.lon),
    fiche.commune,
    fiche.surElement,
    fiche.surElementAutre,
    fiche.ouverturePaysage,
    fiche.habitatPrincipal,
    fiche.habitatSecondaire,
    fiche.habitatPrincipalAutre,
    fiche.habitatSecondaireAutre,
    fiche.gestion,
    fiche.eclairage,
    decimalCell(fiche.hauteurPoseM),
    decimalCell(fiche.orientationDeg),
    decimalCell(fiche.temperatureC),
    fiche.typeNuit,
    fiche.conditionsMeteo.join('|'),
    fiche.commentaires,
    photoCount,
    photoNames.join('|'),
    fiche.createdAt,
    fiche.updatedAt,
  ]
}

export function ficheToCSV(fiche: FicheData, photoCount: number, user?: CsvUser, photoNames: string[] = []): string {
  const body = csvRow(fiche, photoCount, user, photoNames).map(csvCell).join(';')
  return [CSV_HEADER.join(';'), body].join('\r\n')
}

export interface FicheExportRow {
  fiche: FicheData
  photoCount: number
  userName?: string | null
  photoNames?: string[]
}

export function fichesToCSV(rows: FicheExportRow[]): string {
  const body = rows.map(({ fiche, photoCount, userName, photoNames }) =>
    csvRow(fiche, photoCount, userName != null ? { name: userName } : undefined, photoNames ?? []).map(csvCell).join(';'),
  )
  return [CSV_HEADER.join(';'), ...body].join('\r\n')
}

export function ficheToJSON(fiche: FicheData, photos: Array<{ id: string; mimeType: string; storagePath: string | null }>, exportedAt = new Date().toISOString()): string {
  return JSON.stringify({
    exportedAt,
    app: 'AcoustiField',
    fiche,
    photos: photos.map((photo) => ({ id: photo.id, mimeType: photo.mimeType, storagePath: photo.storagePath })),
  }, null, 2)
}

export function fichesToJSON(
  rows: Array<{ fiche: FicheData; photos: Array<{ id: string; mimeType: string; storagePath: string | null }> }>,
  exportedAt = new Date().toISOString(),
): string {
  return JSON.stringify({
    exportedAt,
    app: 'AcoustiField',
    fiches: rows.map(({ fiche, photos }) => ({
      fiche,
      photos: photos.map((photo) => ({ id: photo.id, mimeType: photo.mimeType, storagePath: photo.storagePath })),
    })),
  }, null, 2)
}

export function photoFileName(fiche: Pick<FicheData, 'projet' | 'dateHeurePose' | 'siteNom' | 'operateur'>, position: number): string {
  return `${exportBasename(fiche)} - ${String(position + 1).padStart(2, '0')}.jpg`
}

export async function buildPhotosZip(fiche: FicheData, photos: PhotoData[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const folder = zip.folder(fiche.id) ?? zip
  for (const photo of photos) {
    folder.file(photoFileName(fiche, photo.position), photo.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function buildPhotosZipAll(items: Array<{ fiche: FicheData; photos: PhotoData[] }>): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const { fiche, photos } of items) {
    if (photos.length === 0) continue
    const folder = zip.folder(fiche.id) ?? zip
    for (const photo of photos) {
      folder.file(photoFileName(fiche, photo.position), photo.blob)
    }
  }
  return zip.generateAsync({ type: 'blob' })
}

export interface ProjectCsvGroup {
  projet: string
  csv: string
}

export async function buildProjectCsvZip(groups: ProjectCsvGroup[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const usedNames = new Set<string>()
  for (const group of groups) {
    let name = sanitizeFilePart(group.projet || 'Sans projet')
    if (!name) name = 'Sans projet'
    let unique = name
    let counter = 2
    while (usedNames.has(unique)) {
      unique = `${name}-${counter}`
      counter += 1
    }
    usedNames.add(unique)
    zip.file(`${unique}.csv`, '\uFEFF' + group.csv)
  }
  return zip.generateAsync({ type: 'blob' })
}

function sanitizeFilePart(text: string): string {
  return text
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80)
}

export function exportBasename(fiche: Pick<FicheData, 'projet' | 'dateHeurePose' | 'siteNom' | 'operateur'>): string {
  const parts = [fiche.projet, fiche.dateHeurePose, fiche.siteNom, fiche.operateur]
    .map(sanitizeFilePart)
    .filter(Boolean)
  return parts.join(' - ') || 'fiche'
}

export function downloadText(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadCSV(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function slugify(input: string): string {
  return stripAccents(input.trim().toLowerCase()).replace(/[^a-z0-9-_]+/g, '-').replace(/-+/g, '-')
}
