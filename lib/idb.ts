import type { FicheData } from './fiches'

export type { FicheData } from './fiches'

const DB_NAME = 'acoustifield'
const DB_VERSION = 1
const STORE_FICHES = 'fiches'
const STORE_PHOTOS = 'photos'
const STORE_REMOTE_FICHES = 'remote_fiches'
const STORE_TOMBSTONES = 'tombstones'
const STORE_OFFLINE_PROFILE = 'offline_profile'
const ACTIVE_OFFLINE_PROFILE_ID = 'active'

export interface OfflineProfile {
  ownerId: string
  displayName: string
  avatarUrl: string | null
  lastVerifiedAt: string
  preparedVersion: string | null
  offlineEnabled: boolean
}

interface StoredOfflineProfile extends OfflineProfile {
  id: typeof ACTIVE_OFFLINE_PROFILE_ID
}

export interface PhotoData {
  id: string
  ficheId: string
  ownerId: string
  blob: Blob
  mimeType: string
  position: number
  storagePath: string | null
  uploadedAt: string | null
  pending: boolean
  createdAt: string
}

export interface RemotePhotoRef {
  id: string
  ficheId: string
  userId: string
  storagePath: string
  position: number
}

export interface RemoteFicheData extends FicheData {
  userId: string
  userName: string | null
  cachedBy: string
  photos: RemotePhotoRef[]
}

export interface FicheTombstone {
  id: string
  ficheId: string
  ownerId: string
  deletedAt: string
  lastError: string | null
}

let _db: Promise<IDBDatabase> | null = null

export async function resetDatabaseForTests(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') throw new Error('Disponible uniquement dans les tests')
  const current = await _db?.catch(() => null)
  current?.close()
  _db = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Suppression IndexedDB bloquée'))
  })
}

export async function closeDatabaseForTests(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') throw new Error('Disponible uniquement dans les tests')
  const current = await _db?.catch(() => null)
  current?.close()
  _db = null
}

function openDB(): Promise<IDBDatabase> {
  if (!_db) {
    _db = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_FICHES)) {
          const store = db.createObjectStore(STORE_FICHES, { keyPath: 'id' })
          store.createIndex('ownerId', 'ownerId', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          const store = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' })
          store.createIndex('ficheId', 'ficheId', { unique: false })
          store.createIndex('ownerId', 'ownerId', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_REMOTE_FICHES)) {
          const store = db.createObjectStore(STORE_REMOTE_FICHES, { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
          store.createIndex('cachedBy', 'cachedBy', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_TOMBSTONES)) {
          const store = db.createObjectStore(STORE_TOMBSTONES, { keyPath: 'id' })
          store.createIndex('ownerId', 'ownerId', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE_PROFILE)) {
          db.createObjectStore(STORE_OFFLINE_PROFILE, { keyPath: 'id' })
        }
      }
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
      req.onerror = () => { _db = null; reject(req.error) }
    })
  }
  return _db
}

function hydrateOfflineProfile(raw: unknown): OfflineProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<StoredOfflineProfile>
  if (
    value.id !== ACTIVE_OFFLINE_PROFILE_ID ||
    typeof value.ownerId !== 'string' || !value.ownerId ||
    typeof value.displayName !== 'string' || !value.displayName ||
    typeof value.lastVerifiedAt !== 'string' || !value.lastVerifiedAt ||
    value.offlineEnabled !== true
  ) return null

  return {
    ownerId: value.ownerId,
    displayName: value.displayName,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : null,
    lastVerifiedAt: value.lastVerifiedAt,
    preparedVersion: typeof value.preparedVersion === 'string' ? value.preparedVersion : null,
    offlineEnabled: true,
  }
}

export async function getOfflineProfile(): Promise<OfflineProfile | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_OFFLINE_PROFILE).objectStore(STORE_OFFLINE_PROFILE).get(ACTIVE_OFFLINE_PROFILE_ID)
    request.onsuccess = () => resolve(hydrateOfflineProfile(request.result))
    request.onerror = () => reject(request.error)
  })
}

export async function setOfflineProfile(profile: OfflineProfile): Promise<void> {
  if (!profile.ownerId || !profile.displayName || !profile.lastVerifiedAt) {
    throw new Error('Profil offline invalide')
  }
  const stored: StoredOfflineProfile = {
    id: ACTIVE_OFFLINE_PROFILE_ID,
    ...profile,
    avatarUrl: profile.avatarUrl || null,
    preparedVersion: profile.preparedVersion || null,
    offlineEnabled: true,
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_PROFILE, 'readwrite')
    tx.objectStore(STORE_OFFLINE_PROFILE).put(stored)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function setOfflinePreparedVersion(ownerId: string, preparedVersion: string): Promise<void> {
  if (!ownerId || !preparedVersion) throw new Error('Version offline invalide')
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_PROFILE, 'readwrite')
    const store = tx.objectStore(STORE_OFFLINE_PROFILE)
    const request = store.get(ACTIVE_OFFLINE_PROFILE_ID)
    request.onsuccess = () => {
      const existing = request.result as StoredOfflineProfile | undefined
      if (existing?.offlineEnabled === true && existing.ownerId === ownerId) {
        store.put({ ...existing, preparedVersion })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function disableOfflineProfile(): Promise<void> {
  const db = await openDB()
  const existing = await new Promise<StoredOfflineProfile | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_OFFLINE_PROFILE).objectStore(STORE_OFFLINE_PROFILE).get(ACTIVE_OFFLINE_PROFILE_ID)
    request.onsuccess = () => resolve(request.result as StoredOfflineProfile | undefined)
    request.onerror = () => reject(request.error)
  })
  if (!existing) return

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_PROFILE, 'readwrite')
    tx.objectStore(STORE_OFFLINE_PROFILE).put({ ...existing, offlineEnabled: false })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function checkIndexedDbAvailability(): Promise<boolean> {
  try {
    const db = await openDB()
    const expectedStores = [
      STORE_FICHES,
      STORE_PHOTOS,
      STORE_REMOTE_FICHES,
      STORE_TOMBSTONES,
      STORE_OFFLINE_PROFILE,
    ]
    if (db.version !== DB_VERSION || expectedStores.some((name) => !db.objectStoreNames.contains(name))) return false
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_OFFLINE_PROFILE).objectStore(STORE_OFFLINE_PROFILE).count()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    return true
  } catch {
    return false
  }
}

function hydrateFiche(raw: Record<string, unknown>): FicheData {
  if (!raw.id || !raw.ownerId) throw new Error('Fiche IndexedDB invalide')
  return {
    id: raw.id as string,
    ownerId: raw.ownerId as string,
    appareilType: (raw.appareilType as string) ?? '',
    boitierNum: (raw.boitierNum as string) ?? '',
    microNum: (raw.microNum as string) ?? '',
    carteSdPleine: raw.carteSdPleine === true,
    projet: (raw.projet as string) ?? '',
    operateur: (raw.operateur as string) ?? '',
    dateHeurePose: (raw.dateHeurePose as string) ?? '',
    dateHeureRecherche: (raw.dateHeureRecherche as string) ?? '',
    nbNuitsEcoute: typeof raw.nbNuitsEcoute === 'number' ? raw.nbNuitsEcoute : null,
    siteNom: (raw.siteNom as string) ?? '',
    lat: typeof raw.lat === 'number' ? raw.lat : null,
    lon: typeof raw.lon === 'number' ? raw.lon : null,
    commune: (raw.commune as string) ?? '',
    surElement: (raw.surElement as string) ?? '',
    surElementAutre: (raw.surElementAutre as string) ?? '',
    ouverturePaysage: (raw.ouverturePaysage as string) ?? '',
    habitatPrincipal: (raw.habitatPrincipal as string) ?? '',
    habitatSecondaire: (raw.habitatSecondaire as string) ?? '',
    habitatPrincipalAutre: (raw.habitatPrincipalAutre as string) ?? '',
    habitatSecondaireAutre: (raw.habitatSecondaireAutre as string) ?? '',
    gestion: (raw.gestion as string) ?? '',
    eclairage: (raw.eclairage as string) ?? '',
    hauteurPoseM: typeof raw.hauteurPoseM === 'number' ? raw.hauteurPoseM : null,
    orientationDeg: typeof raw.orientationDeg === 'number' ? raw.orientationDeg : null,
    temperatureC: typeof raw.temperatureC === 'number' ? raw.temperatureC : null,
    typeNuit: (raw.typeNuit as string) ?? '',
    conditionsMeteo: Array.isArray(raw.conditionsMeteo) ? (raw.conditionsMeteo as string[]) : [],
    commentaires: (raw.commentaires as string) ?? '',
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) ?? new Date().toISOString(),
    syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : null,
    dirty: typeof raw.dirty === 'boolean' ? raw.dirty : !raw.syncedAt,
    lastSyncedRemoteRevision: typeof raw.lastSyncedRemoteRevision === 'number' ? raw.lastSyncedRemoteRevision : null,
    syncError: typeof raw.syncError === 'string' ? raw.syncError : null,
  }
}

function hydratePhoto(raw: Record<string, unknown>): PhotoData {
  if (!raw.id || !raw.ficheId || !raw.ownerId || !(raw.blob instanceof Blob)) {
    throw new Error('Photo IndexedDB invalide')
  }
  return {
    id: raw.id as string,
    ficheId: raw.ficheId as string,
    ownerId: raw.ownerId as string,
    blob: raw.blob as Blob,
    mimeType: (raw.mimeType as string) ?? 'image/jpeg',
    position: (raw.position as number) ?? 0,
    storagePath: typeof raw.storagePath === 'string' ? raw.storagePath : null,
    uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : null,
    pending: raw.pending === true,
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
  }
}

export async function saveFiche(fiche: FicheData): Promise<void> {
  if (!fiche.ownerId) throw new Error('Propriétaire de fiche invalide')
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FICHES, 'readwrite')
    tx.objectStore(STORE_FICHES).put(fiche)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getFiches(ownerId: string): Promise<FicheData[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FICHES, 'readonly')
    const req = tx.objectStore(STORE_FICHES).index('ownerId').getAll(ownerId)
    req.onsuccess = () => {
      try {
        resolve((req.result as Record<string, unknown>[])
          .map(hydrateFiche)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      } catch (error) { reject(error) }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getFicheById(ownerId: string, id: string): Promise<FicheData | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FICHES, 'readonly')
    const req = tx.objectStore(STORE_FICHES).get(id)
    req.onsuccess = () => {
      const raw = req.result as Record<string, unknown> | undefined
      resolve(raw && raw.ownerId === ownerId ? hydrateFiche(raw) : undefined)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFiche(ownerId: string, ficheId: string, createTombstone = true): Promise<void> {
  const db = await openDB()
  const fiche = await getFicheById(ownerId, ficheId)
  if (!fiche) return
  const photos = await getPhotosByFiche(ownerId, ficheId)
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_FICHES, STORE_PHOTOS, STORE_TOMBSTONES], 'readwrite')
    tx.objectStore(STORE_FICHES).delete(ficheId)
    for (const photo of photos) {
      tx.objectStore(STORE_PHOTOS).delete(photo.id)
    }
    if (createTombstone && fiche.syncedAt) {
      const tombstone: FicheTombstone = {
        id: `${ownerId}:${ficheId}`,
        ficheId,
        ownerId,
        deletedAt: new Date().toISOString(),
        lastError: null,
      }
      tx.objectStore(STORE_TOMBSTONES).put(tombstone)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function savePhoto(photo: PhotoData): Promise<void> {
  if (!photo.ownerId || !photo.ficheId) throw new Error('Photo invalide')
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite')
    tx.objectStore(STORE_PHOTOS).put(photo)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPhotosByFiche(ownerId: string, ficheId: string): Promise<PhotoData[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readonly')
    const req = tx.objectStore(STORE_PHOTOS).index('ficheId').getAll(ficheId)
    req.onsuccess = () => {
      try {
        resolve((req.result as Record<string, unknown>[])
          .filter((photo) => photo.ownerId === ownerId)
          .map(hydratePhoto)
          .sort((a, b) => a.position - b.position))
      } catch (error) { reject(error) }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getPhotoById(ownerId: string, id: string): Promise<PhotoData | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readonly')
    const req = tx.objectStore(STORE_PHOTOS).get(id)
    req.onsuccess = () => {
      const raw = req.result as Record<string, unknown> | undefined
      resolve(raw && raw.ownerId === ownerId ? hydratePhoto(raw) : undefined)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingPhotos(ownerId: string): Promise<PhotoData[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readonly')
    const req = tx.objectStore(STORE_PHOTOS).index('ownerId').getAll(ownerId)
    req.onsuccess = () => {
      try {
        resolve((req.result as Record<string, unknown>[])
          .map(hydratePhoto)
          .filter((photo) => photo.pending)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
      } catch (error) { reject(error) }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deletePhoto(ownerId: string, photoId: string): Promise<void> {
  const db = await openDB()
  const photo = await getPhotoById(ownerId, photoId)
  if (!photo) return
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite')
    tx.objectStore(STORE_PHOTOS).delete(photoId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getTombstones(ownerId: string): Promise<FicheTombstone[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_TOMBSTONES).objectStore(STORE_TOMBSTONES).index('ownerId').getAll(ownerId)
    req.onsuccess = () => resolve(req.result as FicheTombstone[])
    req.onerror = () => reject(req.error)
  })
}

export async function saveTombstone(tombstone: FicheTombstone): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TOMBSTONES, 'readwrite')
    tx.objectStore(STORE_TOMBSTONES).put(tombstone)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function removeTombstone(ownerId: string, ficheId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TOMBSTONES, 'readwrite')
    tx.objectStore(STORE_TOMBSTONES).delete(`${ownerId}:${ficheId}`)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveRemoteFiche(fiche: RemoteFicheData): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REMOTE_FICHES, 'readwrite')
    tx.objectStore(STORE_REMOTE_FICHES).put(fiche)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getRemoteFiches(cachedBy: string): Promise<RemoteFicheData[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REMOTE_FICHES, 'readonly')
    const req = tx.objectStore(STORE_REMOTE_FICHES).index('cachedBy').getAll(cachedBy)
    req.onsuccess = () => resolve((req.result as RemoteFicheData[])
      .filter((fiche) => fiche.cachedBy === cachedBy)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    req.onerror = () => reject(req.error)
  })
}

export async function clearRemoteFiches(cachedBy: string): Promise<void> {
  const db = await openDB()
  const fiches = await getRemoteFiches(cachedBy)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_REMOTE_FICHES, 'readwrite')
    fiches.forEach((fiche) => tx.objectStore(STORE_REMOTE_FICHES).delete(fiche.id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
