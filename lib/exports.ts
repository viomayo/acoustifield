import type { FicheData, PhotoData } from './idb'

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  return /[;",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function ficheToCSV(fiche: FicheData, photoCount: number, user?: { id?: string | null; name?: string | null }): string {
  const header = [
    'fiche_id', 'user_id', 'user_name', 'date_debut_nuit', 'appareil_type', 'boitier_num', 'micro_num',
    'carte_sd_pleine', 'projet', 'operateur', 'site_nom', 'lat', 'lon', 'commune',
    'sur_element', 'sur_element_autre', 'ouverture_paysage', 'habitat_principal', 'habitat_secondaire',
    'habitat_principal_autre', 'habitat_secondaire_autre',
    'gestion', 'eclairage', 'hauteur_pose_m', 'orientation_deg', 'temperature_c', 'type_nuit', 'conditions_meteo',
    'commentaires', 'nb_photos', 'cree_le', 'mis_a_jour_le',
  ].join(';')
  const row = [
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
    fiche.createdAt,
    fiche.updatedAt,
  ]
  const body = row.map(csvCell).join(';')
  return `\uFEFF${[header, body].join('\r\n')}`
}

export function ficheToJSON(fiche: FicheData, photos: Array<{ id: string; mimeType: string; storagePath: string | null }>, exportedAt = new Date().toISOString()): string {
  return JSON.stringify({
    exportedAt,
    app: 'AcoustiField',
    fiche,
    photos: photos.map((photo) => ({ id: photo.id, mimeType: photo.mimeType, storagePath: photo.storagePath })),
  }, null, 2)
}

export async function buildPhotosZip(fiche: FicheData, photos: PhotoData[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const folder = zip.folder(fiche.id) ?? zip
  const name = fiche.siteNom.trim() || fiche.id
  for (const photo of photos) {
    folder.file(`${String(photo.position).padStart(2, '0')}-${stripAccents(name).replace(/[^a-zA-Z0-9-_]+/g, '-')}.jpg`, photo.blob)
  }
  return zip.generateAsync({ type: 'blob' })
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
