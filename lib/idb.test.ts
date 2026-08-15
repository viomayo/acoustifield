// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkIndexedDbAvailability,
  clearRemoteFiches,
  deleteFiche,
  deletePhoto,
  disableOfflineProfile,
  getFicheById,
  getFiches,
  getOfflineProfile,
  getPendingPhotos,
  getPhotoById,
  getPhotosByFiche,
  getRemoteFiches,
  getTombstones,
  removeTombstone,
  resetDatabaseForTests,
  saveFiche,
  savePhoto,
  saveRemoteFiche,
  saveTombstone,
  setOfflinePreparedVersion,
  setOfflineProfile,
} from './idb'
import { makeFiche, makePhoto, makeRemoteFiche, makeTombstone } from './test-fixtures'

beforeEach(async () => {
  await resetDatabaseForTests()
})

describe('IndexedDB storage', () => {
  it('reports that the database is available', async () => {
    expect(await checkIndexedDbAvailability()).toBe(true)
  })

  it('saves and lists the fiches of an owner, newest first', async () => {
    await saveFiche(makeFiche({ id: 'f1', updatedAt: '2026-08-14T10:00:00.000Z' }))
    await saveFiche(makeFiche({ id: 'f2', updatedAt: '2026-08-15T10:00:00.000Z' }))
    const fiches = await getFiches('user-a')
    expect(fiches.map((fiche) => fiche.id)).toEqual(['f2', 'f1'])
  })

  it('isolates fiches per owner', async () => {
    await saveFiche(makeFiche({ id: 'f1', ownerId: 'user-a' }))
    expect(await getFiches('user-b')).toEqual([])
    expect(await getFicheById('user-b', 'f1')).toBeUndefined()
    expect((await getFicheById('user-a', 'f1'))?.id).toBe('f1')
  })

  it('round-trips every fiche field', async () => {
    const fiche = makeFiche()
    await saveFiche(fiche)
    const [stored] = await getFiches('user-a')
    expect(stored).toEqual(fiche)
  })

  it('rejects a fiche without an owner', async () => {
    await expect(saveFiche(makeFiche({ ownerId: '' }))).rejects.toThrow('Propriétaire de fiche invalide')
  })

  it('orders the photos of a fiche by position and scopes them to the owner', async () => {
    await savePhoto(makePhoto({ id: 'p2', position: 1 }))
    await savePhoto(makePhoto({ id: 'p1', position: 0 }))
    await savePhoto(makePhoto({ id: 'p3', position: 0, ownerId: 'user-b' }))
    const photos = await getPhotosByFiche('user-a', 'fiche-1')
    expect(photos.map((photo) => photo.id)).toEqual(['p1', 'p2'])
  })

  it('lists only the photos awaiting upload', async () => {
    await savePhoto(makePhoto({ id: 'p1', pending: true }))
    await savePhoto(makePhoto({ id: 'p2', pending: false, storagePath: 'x', uploadedAt: '2026-08-14T20:00:00.000Z' }))
    const pending = await getPendingPhotos('user-a')
    expect(pending.map((photo) => photo.id)).toEqual(['p1'])
  })

  it('reads and deletes a photo of its owner', async () => {
    await savePhoto(makePhoto())
    expect((await getPhotoById('user-a', 'photo-1'))?.id).toBe('photo-1')
    expect(await getPhotoById('user-b', 'photo-1')).toBeUndefined()
    await deletePhoto('user-a', 'photo-1')
    expect(await getPhotosByFiche('user-a', 'fiche-1')).toEqual([])
  })

  it('rejects a photo without an owner', async () => {
    await expect(savePhoto(makePhoto({ ownerId: '' }))).rejects.toThrow('Photo invalide')
  })

  it('deletes a fiche and its photos without a tombstone when never synced', async () => {
    await saveFiche(makeFiche({ syncedAt: null }))
    await savePhoto(makePhoto())
    await deleteFiche('user-a', 'fiche-1')
    expect(await getFiches('user-a')).toEqual([])
    expect(await getPhotosByFiche('user-a', 'fiche-1')).toEqual([])
    expect(await getTombstones('user-a')).toEqual([])
  })

  it('records a tombstone when the deleted fiche had been synced', async () => {
    await saveFiche(makeFiche({ syncedAt: '2026-08-14T20:00:00.000Z' }))
    await deleteFiche('user-a', 'fiche-1')
    const tombstones = await getTombstones('user-a')
    expect(tombstones).toHaveLength(1)
    expect(tombstones[0].ficheId).toBe('fiche-1')
  })

  it('ignores deletion of a fiche belonging to another owner', async () => {
    await saveFiche(makeFiche({ ownerId: 'user-b' }))
    await deleteFiche('user-a', 'fiche-1')
    expect(await getFiches('user-b')).toHaveLength(1)
  })

  it('stores and removes tombstones', async () => {
    await saveTombstone(makeTombstone())
    expect(await getTombstones('user-a')).toHaveLength(1)
    await removeTombstone('user-a', 'fiche-1')
    expect(await getTombstones('user-a')).toEqual([])
  })

  it('persists, refreshes and disables the offline profile', async () => {
    await setOfflineProfile({
      ownerId: 'user-a',
      displayName: 'Alice',
      avatarUrl: null,
      lastVerifiedAt: '2026-08-14T20:00:00.000Z',
      preparedVersion: null,
      offlineEnabled: true,
    })
    expect((await getOfflineProfile())?.ownerId).toBe('user-a')

    await setOfflinePreparedVersion('user-a', 'v1')
    expect((await getOfflineProfile())?.preparedVersion).toBe('v1')

    await disableOfflineProfile()
    expect(await getOfflineProfile()).toBeNull()
  })

  it('rejects an invalid offline profile', async () => {
    await expect(
      setOfflineProfile({
        ownerId: '',
        displayName: 'Alice',
        avatarUrl: null,
        lastVerifiedAt: '2026-08-14T20:00:00.000Z',
        preparedVersion: null,
        offlineEnabled: true,
      }),
    ).rejects.toThrow('Profil offline invalide')
  })

  it('ignores a prepared version for a foreign owner', async () => {
    await setOfflineProfile({
      ownerId: 'user-a',
      displayName: 'Alice',
      avatarUrl: null,
      lastVerifiedAt: '2026-08-14T20:00:00.000Z',
      preparedVersion: null,
      offlineEnabled: true,
    })
    await setOfflinePreparedVersion('user-b', 'v1')
    expect((await getOfflineProfile())?.preparedVersion).toBeNull()
  })

  it('caches remote fiches per supervisor account', async () => {
    await saveRemoteFiche(makeRemoteFiche({ id: 'ra' }))
    await saveRemoteFiche(makeRemoteFiche({ id: 'rb', updatedAt: '2026-08-15T10:00:00.000Z' }))
    await saveRemoteFiche(makeRemoteFiche({ id: 'rc', cachedBy: 'user-c' }))
    const cached = await getRemoteFiches('user-a')
    expect(cached.map((fiche) => fiche.id)).toEqual(['rb', 'ra'])

    await clearRemoteFiches('user-a')
    expect(await getRemoteFiches('user-a')).toEqual([])
    expect(await getRemoteFiches('user-c')).toHaveLength(1)
  })
})
