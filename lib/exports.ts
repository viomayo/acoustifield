import type { FicheData, PhotoData } from './idb'

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  return /[;",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const CSV_HEADER = [
  'fiche_id', 'user_id', 'user_name', 'date_debut_nuit', 'appareil_type', 'boitier_num', 'micro_num',
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
    fiche.dateDebutNuit,
    fiche.appareilType,
    fiche.boitierNum,
    fiche.microNum,
    fiche.carteSdPleine ? '1' : '0',
    fiche.projet,
    fiche.operateur,
    fiche.siteNom,
    fiche.lat,
    fiche.lon,
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
    fiche.hauteurPoseM,
    fiche.orientationDeg,
    fiche.temperatureC,
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
  return `\uFEFF${[CSV_HEADER.join(';'), body].join('\r\n')}`
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
  return `\uFEFF${[CSV_HEADER.join(';'), ...body].join('\r\n')}`
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

export function photoFileName(fiche: Pick<FicheData, 'projet' | 'dateDebutNuit' | 'siteNom' | 'operateur'>, position: number): string {
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
    zip.file(`${unique}.csv`, group.csv)
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

export function exportBasename(fiche: Pick<FicheData, 'projet' | 'dateDebutNuit' | 'siteNom' | 'operateur'>): string {
  const parts = [fiche.projet, fiche.dateDebutNuit, fiche.siteNom, fiche.operateur]
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
