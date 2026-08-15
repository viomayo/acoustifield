import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './client'
import {
  clearRemoteFiches,
  getFicheById,
  getFiches,
  getPendingPhotos,
  getPhotoById,
  getPhotosByFiche,
  getRemoteFiches,
  getTombstones,
  removeTombstone,
  saveFiche,
  savePhoto,
  saveRemoteFiche,
  saveTombstone,
  type FicheData,
  type PhotoData,
  type RemoteFicheData,
  type RemotePhotoRef,
} from '@/lib/idb'

const CONFLICTS_KEY = 'acoustifield-conflicts'
export const SYNC_STATE_EVENT = 'acoustifield-sync-state'

export interface PhotoSnapshotRow {
  id: string
  storage_path: string
  position: number
}

export interface FicheSnapshot {
  fiche: Record<string, unknown>
  photos: PhotoSnapshotRow[]
}

export interface SyncConflict {
  ficheId: string
  ficheLabel: string
  fields: { field: string; local: string; remote: string }[]
}

export interface SyncFailure {
  ficheId: string
  message: string
}

export interface SyncResult {
  synced: number
  deleted: number
  errors: number
  conflicts: SyncConflict[]
  failures: SyncFailure[]
}

export interface PullResult {
  imported: number
  merged: number
  errors: number
  conflicts: SyncConflict[]
  failures: SyncFailure[]
}

function emitSyncState() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_STATE_EVENT))
}

export function ficheLabel(fiche: FicheData): string {
  const site = fiche.siteNom.trim()
  const date = fiche.dateDebutNuit
  return [date, fiche.appareilType, site].filter(Boolean).join(' — ') || 'Fiche sans titre'
}

export async function buildLocalSnapshot(fiche: FicheData, photos: PhotoData[]): Promise<FicheSnapshot> {
  return {
    fiche: {
      id: fiche.id,
      appareil_type: fiche.appareilType,
      boitier_num: fiche.boitierNum,
      micro_num: fiche.microNum,
      carte_sd_pleine: fiche.carteSdPleine,
      projet: fiche.projet,
      operateur: fiche.operateur,
      date_debut_nuit: fiche.dateDebutNuit || null,
      site_nom: fiche.siteNom,
      lat: fiche.lat,
      lon: fiche.lon,
      commune: fiche.commune,
      sur_element: fiche.surElement,
      sur_element_autre: fiche.surElementAutre,
      ouverture_paysage: fiche.ouverturePaysage || null,
      habitat_principal: fiche.habitatPrincipal,
      habitat_secondaire: fiche.habitatSecondaire,
      habitat_principal_autre: fiche.habitatPrincipalAutre,
      habitat_secondaire_autre: fiche.habitatSecondaireAutre,
      gestion: fiche.gestion,
      eclairage: fiche.eclairage || null,
      hauteur_pose_m: fiche.hauteurPoseM,
      orientation_deg: fiche.orientationDeg,
      temperature_c: fiche.temperatureC,
      type_nuit: fiche.typeNuit || null,
      conditions_meteo: fiche.conditionsMeteo,
      commentaires: fiche.commentaires,
      created_at: fiche.createdAt,
    },
    photos: photos
      .filter((photo) => photo.storagePath)
      .map((photo) => ({
        id: photo.id,
        storage_path: photo.storagePath!,
        position: photo.position,
      })),
  }
}

export function mapFicheRow(ownerId: string, row: Record<string, unknown>): FicheData {
  return {
    id: row.id as string,
    ownerId,
    appareilType: (row.appareil_type as string) ?? '',
    boitierNum: (row.boitier_num as string) ?? '',
    microNum: (row.micro_num as string) ?? '',
    carteSdPleine: row.carte_sd_pleine === true,
    projet: (row.projet as string) ?? '',
    operateur: (row.operateur as string) ?? '',
    dateDebutNuit: (row.date_debut_nuit as string) ?? '',
    siteNom: (row.site_nom as string) ?? '',
    lat: typeof row.lat === 'number' ? row.lat : null,
    lon: typeof row.lon === 'number' ? row.lon : null,
    commune: (row.commune as string) ?? '',
    surElement: (row.sur_element as string) ?? '',
    surElementAutre: (row.sur_element_autre as string) ?? '',
    ouverturePaysage: (row.ouverture_paysage as string) ?? '',
    habitatPrincipal: (row.habitat_principal as string) ?? '',
    habitatSecondaire: (row.habitat_secondaire as string) ?? '',
    habitatPrincipalAutre: (row.habitat_principal_autre as string) ?? '',
    habitatSecondaireAutre: (row.habitat_secondaire_autre as string) ?? '',
    gestion: (row.gestion as string) ?? '',
    eclairage: (row.eclairage as string) ?? '',
    hauteurPoseM: typeof row.hauteur_pose_m === 'number' ? row.hauteur_pose_m : null,
    orientationDeg: typeof row.orientation_deg === 'number' ? row.orientation_deg : null,
    temperatureC: typeof row.temperature_c === 'number' ? row.temperature_c : null,
    typeNuit: (row.type_nuit as string) ?? '',
    conditionsMeteo: Array.isArray(row.conditions_meteo) ? (row.conditions_meteo as string[]) : [],
    commentaires: (row.commentaires as string) ?? '',
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    dirty: false,
    lastSyncedRemoteRevision: Number(row.sync_revision ?? 0),
    syncError: null,
  }
}

function format(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null)
}

async function fetchRemoteFicheRows(
  supabase: SupabaseClient,
  ficheId: string,
): Promise<{ row: Record<string, unknown>; photos: RemotePhotoRef[] } | null> {
  const [{ data: row, error: ficheError }, { data: photoRows, error: photoError }] = await Promise.all([
    supabase.from('fiches').select('*').eq('id', ficheId).single(),
    supabase.from('photos').select('*').eq('fiche_id', ficheId).order('position'),
  ])
  if (ficheError || photoError || !row || !photoRows) return null
  const photos = (photoRows as Record<string, unknown>[]).map((photo) => ({
    id: photo.id as string,
    ficheId,
    userId: photo.user_id as string,
    storagePath: photo.storage_path as string,
    position: (photo.position as number) ?? 0,
  }))
  return { row: row as Record<string, unknown>, photos }
}

export async function buildSyncConflict(local: FicheData, remote: FicheData): Promise<SyncConflict> {
  const pairs: Array<[string, unknown, unknown]> = [
    ['Appareil', { appareil: local.appareilType, boitier: local.boitierNum, micro: local.microNum, sd: local.carteSdPleine }, { appareil: remote.appareilType, boitier: remote.boitierNum, micro: remote.microNum, sd: remote.carteSdPleine }],
    ['Contexte', { projet: local.projet, operateur: local.operateur, date: local.dateDebutNuit }, { projet: remote.projet, operateur: remote.operateur, date: remote.dateDebutNuit }],
    ['Site', { nom: local.siteNom, lat: local.lat, lon: local.lon, commune: local.commune }, { nom: remote.siteNom, lat: remote.lat, lon: remote.lon, commune: remote.commune }],
    ['Milieu', { sur: local.surElement, autre: local.surElementAutre, ouverture: local.ouverturePaysage, habitat: local.habitatPrincipal, secondaire: local.habitatSecondaire, habitatAutre: local.habitatPrincipalAutre, secondaireAutre: local.habitatSecondaireAutre, gestion: local.gestion, eclairage: local.eclairage, hauteur: local.hauteurPoseM, orientation: local.orientationDeg }, { sur: remote.surElement, autre: remote.surElementAutre, ouverture: remote.ouverturePaysage, habitat: remote.habitatPrincipal, secondaire: remote.habitatSecondaire, habitatAutre: remote.habitatPrincipalAutre, secondaireAutre: remote.habitatSecondaireAutre, gestion: remote.gestion, eclairage: remote.eclairage, hauteur: remote.hauteurPoseM, orientation: remote.orientationDeg }],
    ['Météo', { temp: local.temperatureC, type: local.typeNuit, conditions: local.conditionsMeteo }, { temp: remote.temperatureC, type: remote.typeNuit, conditions: remote.conditionsMeteo }],
    ['Commentaires', local.commentaires, remote.commentaires],
  ]
  const fields: SyncConflict['fields'] = []
  for (const [field, localValue, remoteValue] of pairs) {
    if (format(localValue) !== format(remoteValue)) fields.push({ field, local: format(localValue), remote: format(remoteValue) })
  }
  return { ficheId: local.id, ficheLabel: ficheLabel(local), fields }
}

function storeConflicts(conflicts: SyncConflict[]) {
  if (typeof localStorage === 'undefined') return
  if (conflicts.length) localStorage.setItem(CONFLICTS_KEY, JSON.stringify(conflicts))
  else localStorage.removeItem(CONFLICTS_KEY)
  emitSyncState()
}

export function getStoredConflicts(): SyncConflict[] {
  try { return JSON.parse(localStorage.getItem(CONFLICTS_KEY) || '[]') } catch { return [] }
}

export function clearStoredConflicts() { storeConflicts([]) }

async function uploadPendingPhotos(ownerId: string, ficheId: string): Promise<{ uploaded: number; errors: number }> {
  const supabase = createClient()
  const photos = await getPendingPhotos(ownerId)
  let uploaded = 0
  let errors = 0
  for (const photo of photos.filter((p) => p.ficheId === ficheId)) {
    const path = `${ownerId}/${ficheId}/${photo.position}-${photo.id}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(path, photo.blob, { contentType: photo.mimeType, upsert: true })
    if (uploadError) {
      errors++
      continue
    }
    const { error: insertError } = await supabase
      .from('photos')
      .upsert(
        { id: photo.id, fiche_id: ficheId, user_id: ownerId, storage_path: path, position: photo.position },
        { onConflict: 'fiche_id,position' },
      )
    if (insertError) {
      errors++
      continue
    }
    await savePhoto({
      ...photo,
      storagePath: path,
      pending: false,
      uploadedAt: new Date().toISOString(),
    })
    uploaded++
  }
  return { uploaded, errors }
}

async function pushFiche(fiche: FicheData, force = false): Promise<'ok' | 'conflict' | 'error'> {
  const supabase = createClient()
  const photos = await getPhotosByFiche(fiche.ownerId, fiche.id)
  const snapshot = await buildLocalSnapshot(fiche, photos)
  const { data, error } = await supabase.rpc('sync_fiche_snapshot', {
    p_snapshot: snapshot,
    p_expected_revision: fiche.lastSyncedRemoteRevision,
    p_force: force,
  })
  if (error) {
    await saveFiche({ ...fiche, syncError: error.message })
    return 'error'
  }
  const response = data as { status?: string; revision?: number } | null
  if (response?.status === 'conflict') return 'conflict'
  await saveFiche({
    ...fiche,
    syncedAt: new Date().toISOString(),
    dirty: false,
    lastSyncedRemoteRevision: Number(response?.revision ?? 0),
    syncError: null,
  })
  return 'ok'
}

async function pushTombstones(ownerId: string, result: SyncResult) {
  const supabase = createClient()
  for (const tombstone of await getTombstones(ownerId)) {
    await deleteRemoteFicheContents(ownerId, tombstone.ficheId)
    const { error } = await supabase.from('fiches').delete().eq('id', tombstone.ficheId)
    if (error) {
      result.errors++
      result.failures.push({ ficheId: tombstone.ficheId, message: error.message })
      await saveTombstone({ ...tombstone, lastError: error.message })
    } else {
      result.deleted++
      await removeTombstone(ownerId, tombstone.ficheId)
    }
  }
}

async function deleteRemoteFicheContents(ownerId: string, ficheId: string) {
  const supabase = createClient()
  try {
    const { data } = await supabase.storage.from('photos').list(`${ownerId}/${ficheId}`, { search: '', limit: 100 })
    if (data && data.length > 0) {
      await supabase.storage.from('photos').remove(data.map((file) => `${ownerId}/${ficheId}/${file.name}`))
    }
  } catch {
    // L'effacement des objets est best-effort ; la ligne fiche supprimée reste prioritaire.
  }
}

export async function syncAll(ownerId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, deleted: 0, errors: 0, conflicts: [], failures: [] }
  await pushTombstones(ownerId, result)
  for (const fiche of await getFiches(ownerId)) {
    if (!fiche.dirty) continue
    const status = await pushFiche(fiche)
    if (status === 'ok') {
      const photoResult = await uploadPendingPhotos(ownerId, fiche.id)
      result.synced++
      if (photoResult.errors > 0) {
        result.errors += photoResult.errors
        result.failures.push({ ficheId: fiche.id, message: 'Certaines photos restent en attente d’envoi' })
      }
    } else if (status === 'error') {
      result.errors++
      result.failures.push({ ficheId: fiche.id, message: 'Échec du snapshot distant' })
    } else {
      const remote = await fetchRemoteFiche(ownerId, fiche.id)
      if (remote) result.conflicts.push(await buildSyncConflict(fiche, remote.fiche))
      else {
        result.errors++
        result.failures.push({ ficheId: fiche.id, message: 'Conflit distant illisible' })
      }
    }
  }
  storeConflicts(result.conflicts)
  return result
}

async function fetchRemoteFiche(
  ownerId: string,
  ficheId: string,
): Promise<{ fiche: FicheData; photos: RemotePhotoRef[] } | null> {
  const supabase = createClient()
  const remote = await fetchRemoteFicheRows(supabase, ficheId)
  if (!remote) return null
  return { fiche: mapFicheRow(ownerId, remote.row), photos: remote.photos }
}

async function downloadRemotePhotos(ficheId: string, refs: RemotePhotoRef[]): Promise<number> {
  const supabase = createClient()
  let downloaded = 0
  for (const ref of refs) {
    const existing = await getPhotoById(ref.userId, ref.id)
    if (existing) continue
    const { data, error } = await supabase.storage.from('photos').download(ref.storagePath)
    if (error || !data) continue
    await savePhoto({
      id: ref.id,
      ficheId,
      ownerId: ref.userId,
      blob: data,
      mimeType: data.type || 'image/jpeg',
      position: ref.position,
      storagePath: ref.storagePath,
      uploadedAt: new Date().toISOString(),
      pending: false,
      createdAt: new Date().toISOString(),
    })
    downloaded++
  }
  return downloaded
}

export async function pullMyFiches(ownerId: string): Promise<PullResult> {
  const result: PullResult = { imported: 0, merged: 0, errors: 0, conflicts: [], failures: [] }
  const supabase = createClient()
  const { data, error } = await supabase.from('fiches').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
  if (error || !data) {
    result.errors++
    result.failures.push({ ficheId: '*', message: error?.message || 'Réponse distante vide' })
    return result
  }
  const tombstones = new Set((await getTombstones(ownerId)).map((item) => item.ficheId))
  for (const row of data as Record<string, unknown>[]) {
    const ficheId = row.id as string
    if (tombstones.has(ficheId)) continue
    const existing = await getFicheById(ownerId, ficheId)
    const revision = Number(row.sync_revision ?? 0)
    if (existing && existing.lastSyncedRemoteRevision === revision && !existing.dirty) continue
    const remote = await fetchRemoteFiche(ownerId, ficheId)
    if (!remote) {
      result.errors++
      result.failures.push({ ficheId, message: 'Fiche distante incomplète' })
      continue
    }
    if (existing?.dirty) {
      result.conflicts.push(await buildSyncConflict(existing, remote.fiche))
      continue
    }
    await downloadRemotePhotos(ficheId, remote.photos)
    await saveFiche(remote.fiche)
    if (existing) result.merged++
    else result.imported++
  }
  if (result.conflicts.length) storeConflicts(result.conflicts)
  return result
}

export async function pullAllFichesForSupervisor(cachedBy: string): Promise<{ imported: number }> {
  const supabase = createClient()
  const { data: fiches, error } = await supabase.from('fiches').select('*').order('created_at', { ascending: false })
  if (error || !fiches) throw new Error(error?.message || 'Fiches distantes indisponibles')

  const rows = fiches as Record<string, unknown>[]
  const userIds = [...new Set(rows.map((row) => row.user_id as string).filter(Boolean))]
  const names = await fetchProfilesByUsers(userIds)

  const staged: Array<{ fiche: RemoteFicheData }> = []
  for (const row of rows) {
    const userId = row.user_id as string
    if (userId === cachedBy) continue
    const remote = await fetchRemoteFicheRows(supabase, row.id as string)
    if (!remote) throw new Error(`Fiche incomplète: ${String(row.id)}`)
    const fiche = mapFicheRow(userId, remote.row)
    staged.push({
      fiche: {
        ...fiche,
        userId,
        userName: names.get(userId) ?? null,
        cachedBy,
        photos: remote.photos,
      },
    })
  }

  await clearRemoteFiches(cachedBy)
  for (const item of staged) {
    await saveRemoteFiche(item.fiche)
  }
  return { imported: staged.length }
}

async function fetchProfilesByUsers(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (userIds.length === 0) return names
  const supabase = createClient()
  const { data, error } = await supabase.from('profiles').select('id, nom').in('id', userIds)
  if (error || !data) return names
  for (const profile of data as Record<string, unknown>[]) {
    const nom = (profile.nom as string)?.trim()
    if (nom) names.set(profile.id as string, nom)
  }
  return names
}

export async function resolveConflict(ficheId: string, resolution: 'local' | 'remote', ownerId: string): Promise<void> {
  const local = await getFicheById(ownerId, ficheId)
  if (!local) return
  if (resolution === 'local') {
    if (await pushFiche(local, true) !== 'ok') throw new Error('Impossible de forcer le snapshot local')
    const photoResult = await uploadPendingPhotos(ownerId, ficheId)
    if (photoResult.errors > 0) throw new Error('Photos restées en attente')
  } else {
    const remote = await fetchRemoteFiche(ownerId, ficheId)
    if (!remote) throw new Error('Fiche distante indisponible')
    await downloadRemotePhotos(ficheId, remote.photos)
    await saveFiche(remote.fiche)
  }
  storeConflicts(getStoredConflicts().filter((conflict) => conflict.ficheId !== ficheId))
}

export async function deleteFicheFromSupabase(ownerId: string, ficheId: string): Promise<'ok' | 'error'> {
  const supabase = createClient()
  await deleteRemoteFicheContents(ownerId, ficheId)
  const { error } = await supabase.from('fiches').delete().eq('id', ficheId)
  return error ? 'error' : 'ok'
}

export async function getSignedPhotoUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from('photos').createSignedUrl(storagePath, expiresIn)
  return error ? null : (data?.signedUrl ?? null)
}

export async function fetchRemoteFichesCache(cachedBy: string): Promise<RemoteFicheData[]> {
  return getRemoteFiches(cachedBy)
}
