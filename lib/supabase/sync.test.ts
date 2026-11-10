import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FicheData, FicheTombstone, RemoteFicheData } from '../idb'
import {
  buildLocalSnapshot,
  buildSyncConflict,
  clearStoredConflicts,
  deleteFicheFromSupabase,
  fetchRemoteFichesCache,
  ficheLabel,
  getSignedPhotoUrl,
  getStoredConflicts,
  mapFicheRow,
  pullAllFichesForSupervisor,
  pullMyFiches,
  resolveConflict,
  syncAll,
  updateRemoteFicheMetadata,
} from './sync'
import { makeFiche, makePhoto, makeTombstone, makeRemoteFiche } from '../test-fixtures'

const createClientMock = vi.fn()
vi.mock('./client', () => ({ createClient: () => createClientMock() }))

const mocks = vi.hoisted(() => ({
  idb: {
    getFiches: vi.fn(),
    getFicheById: vi.fn(),
    saveFiche: vi.fn(),
    getPhotosByFiche: vi.fn(),
    getPendingPhotos: vi.fn(),
    savePhoto: vi.fn(),
    getPhotoById: vi.fn(),
    getTombstones: vi.fn(),
    saveTombstone: vi.fn(),
    removeTombstone: vi.fn(),
    getRemoteFiches: vi.fn(),
    saveRemoteFiche: vi.fn(),
    clearRemoteFiches: vi.fn(),
  },
}))
vi.mock('@/lib/idb', () => mocks.idb)

type Row = Record<string, unknown>

function remoteRow(fiche: FicheData, revision = 1): Row {
  return {
    id: fiche.id,
    user_id: fiche.ownerId,
    appareil_type: fiche.appareilType,
    boitier_num: fiche.boitierNum,
    micro_num: fiche.microNum,
    carte_sd_pleine: fiche.carteSdPleine,
    projet: fiche.projet,
    operateur: fiche.operateur,
    date_heure_pose: fiche.dateHeurePose || null,
    date_heure_recherche: fiche.dateHeureRecherche || null,
    nb_nuits_ecoute: fiche.nbNuitsEcoute,
    site_nom: fiche.siteNom,
    lat: fiche.lat,
    lon: fiche.lon,
    commune: fiche.commune,
    sur_element: fiche.surElement,
    sur_element_autre: fiche.surElementAutre,
    ouverture_paysage: fiche.ouverturePaysage || null,
    habitat_principal: fiche.habitatPrincipal,
    habitat_secondaire: fiche.habitatSecondaire,
    gestion: fiche.gestion,
    eclairage: fiche.eclairage || null,
    hauteur_pose_m: fiche.hauteurPoseM,
    orientation_deg: fiche.orientationDeg,
    temperature_c: fiche.temperatureC,
    type_nuit: fiche.typeNuit || null,
    conditions_meteo: fiche.conditionsMeteo,
    commentaires: fiche.commentaires,
    programme_enregistrement: fiche.programmeEnregistrement,
    taux_echantillonnage_khz: fiche.tauxEchantillonnageKhz,
    freq_declenchement_min_khz: fiche.freqDeclenchementMinKhz,
    freq_declenchement_max_khz: fiche.freqDeclenchementMaxKhz,
    duree_inter_puls_s: fiche.dureeInterPulsS,
    gain_db: fiche.gainDb,
    duree_max_sequence_s: fiche.dureeMaxSequenceS,
    parametre_filtration: fiche.parametreFiltration,
    moulinette: fiche.moulinette,
    moulinette_autre: fiche.moulinetteAutre,
    destin_bruits: fiche.destinBruits,
    destin_bruits_autre: fiche.destinBruitsAutre,
    created_at: fiche.createdAt,
    updated_at: fiche.updatedAt,
    sync_revision: revision,
  }
}

class FakeStore {
  rows: Record<string, Row[]>

  constructor(init: { fiches?: Row[]; photos?: Row[]; profiles?: Row[] } = {}) {
    this.rows = {
      fiches: init.fiches ?? [],
      photos: init.photos ?? [],
      profiles: init.profiles ?? [],
    }
  }
}

class FakeChain {
  private store: FakeStore
  private table: string
  private deleteMode = false
  private singleMode = false
  private immediate: { data?: unknown; error?: unknown } | null = null
  private eqFilter: [string, unknown] | null = null
  private orderCol: string | null = null

  constructor(store: FakeStore, table: string) {
    this.store = store
    this.table = table
  }

  select() { return this }
  eq(col: string, value: unknown) { this.eqFilter = [col, value]; return this }
  in(col: string, values: unknown[]) { this.eqFilter = [col, values]; return this }
  order(col: string) { this.orderCol = col; return this }
  single() { this.singleMode = true; return this }
  maybeSingle() { this.singleMode = true; return this }
  delete() { this.deleteMode = true; return this }

  upsert(row: Row) {
    const table = this.store.rows[this.table]
    const key = row.id as string
    const index = table.findIndex((existing) => existing.id === key)
    if (index === -1) table.push(row)
    else table[index] = row
    this.immediate = { error: null }
    return this
  }

  then(onFulfilled: (value: unknown) => void) {
    onFulfilled(this.immediate ?? this.evaluate())
  }

  private evaluate(): { data?: unknown; error?: unknown } {
    if (this.deleteMode) {
      if (this.eqFilter) {
        const [col, value] = this.eqFilter
        this.store.rows[this.table] = this.store.rows[this.table].filter((row) => row[col] !== value)
      }
      return { error: null }
    }
    let rows = this.store.rows[this.table].map((row) => ({ ...row }))
    if (this.eqFilter) {
      const [col, value] = this.eqFilter
      rows = rows.filter((row) => (
        Array.isArray(value) ? value.includes(row[col]) : row[col] === value
      ))
    }
    const orderCol = this.orderCol
    if (orderCol) {
      rows.sort((a, b) => String(b[orderCol]).localeCompare(String(a[orderCol])))
    }
    if (this.singleMode) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }
}

function createFakeSupabase(store: FakeStore) {
  const rpc = vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: { status: 'ok', revision: 1 }, error: null }))
  const storageHandlers = {
    upload: vi.fn(async (): Promise<{ error?: unknown }> => ({ error: null })),
    download: vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: new Blob(['image-bytes'], { type: 'image/jpeg' }), error: null })),
    list: vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: [{ name: '0.jpg' }], error: null })),
    remove: vi.fn(async (): Promise<{ error?: unknown }> => ({ error: null })),
    createSignedUrl: vi.fn(async (): Promise<{ data?: unknown; error?: unknown }> => ({ data: { signedUrl: 'https://signed/url' }, error: null })),
  }
  const client = {
    rpc,
    from: (table: string) => new FakeChain(store, table),
    storage: { from: () => storageHandlers },
  }
  return { client, rpc, storageHandlers }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.idb.getTombstones.mockResolvedValue([])
  mocks.idb.getPhotosByFiche.mockResolvedValue([])
  mocks.idb.getPendingPhotos.mockResolvedValue([])
})

describe('synchronisation Supabase', () => {
  it('labels a fiche from its date, device and site', () => {
    expect(ficheLabel(makeFiche())).toBe('2026-08-14T20:00 — SM4BAT — Étang de la Hulotte')
    expect(ficheLabel(makeFiche({ dateHeurePose: '', appareilType: '', siteNom: '  ' }))).toBe('Fiche sans titre')
  })

  it('maps a fiche and its uploaded photos into a snapshot', async () => {
    const fiche = makeFiche({ dateHeurePose: '' })
    const uploaded = makePhoto({ storagePath: 'user-a/fiche-1/0-photo-1.jpg' })
    const pending = makePhoto({ id: 'p-pending', storagePath: null })
    const snapshot = await buildLocalSnapshot(fiche, [uploaded, pending])
    expect(snapshot.fiche.appareil_type).toBe('SM4BAT')
    expect(snapshot.fiche.date_heure_pose).toBeNull()
    expect(snapshot.fiche.created_at).toBe(fiche.createdAt)
    expect(snapshot.photos).toEqual([
      { id: 'photo-1', storage_path: 'user-a/fiche-1/0-photo-1.jpg', position: 0 },
    ])
  })

  it('includes the metadata fields in the snapshot', async () => {
    const fiche = makeFiche({
      programmeEnregistrement: ['Enregistrements continus'],
      tauxEchantillonnageKhz: 384,
      freqDeclenchementMinKhz: 20,
      freqDeclenchementMaxKhz: 120,
      dureeInterPulsS: 2.5,
      gainDb: 12,
      dureeMaxSequenceS: 5,
      parametreFiltration: 'FIR 8 kHz',
      moulinette: 'Autre',
      moulinetteAutre: 'Chirosoft',
      destinBruits: 'Autre',
      destinBruitsAutre: 'Archivage',
    })
    const snapshot = await buildLocalSnapshot(fiche, [])
    expect(snapshot.fiche.programme_enregistrement).toEqual(['Enregistrements continus'])
    expect(snapshot.fiche.taux_echantillonnage_khz).toBe(384)
    expect(snapshot.fiche.freq_declenchement_min_khz).toBe(20)
    expect(snapshot.fiche.freq_declenchement_max_khz).toBe(120)
    expect(snapshot.fiche.duree_inter_puls_s).toBe(2.5)
    expect(snapshot.fiche.gain_db).toBe(12)
    expect(snapshot.fiche.duree_max_sequence_s).toBe(5)
    expect(snapshot.fiche.parametre_filtration).toBe('FIR 8 kHz')
    expect(snapshot.fiche.moulinette).toBe('Autre')
    expect(snapshot.fiche.moulinette_autre).toBe('Chirosoft')
    expect(snapshot.fiche.destin_bruits).toBe('Autre')
    expect(snapshot.fiche.destin_bruits_autre).toBe('Archivage')
  })

  it('parses a remote row into a clean local fiche', () => {
    const fiche = mapFicheRow('user-a', remoteRow(makeFiche(), 3))
    expect(fiche.ownerId).toBe('user-a')
    expect(fiche.dirty).toBe(false)
    expect(fiche.lastSyncedRemoteRevision).toBe(3)
    expect(fiche.conditionsMeteo).toEqual(['Pluie', 'Vent'])
    expect(fiche.syncedAt).toEqual(expect.any(String))
  })

  it('maps the metadata columns of a remote row', () => {
    const fiche = mapFicheRow('user-a', remoteRow(makeFiche({
      programmeEnregistrement: ['½ h avant le coucher du soleil'],
      tauxEchantillonnageKhz: 192,
      freqDeclenchementMinKhz: 15,
      freqDeclenchementMaxKhz: 180,
      dureeInterPulsS: 0.1,
      gainDb: 0,
      dureeMaxSequenceS: 5,
      parametreFiltration: 'Passe-haut',
      moulinette: 'BatDetect2',
      moulinetteAutre: '',
      destinBruits: 'Suppression',
      destinBruitsAutre: '',
    }), 2))
    expect(fiche.programmeEnregistrement).toEqual(['½ h avant le coucher du soleil'])
    expect(fiche.tauxEchantillonnageKhz).toBe(192)
    expect(fiche.freqDeclenchementMinKhz).toBe(15)
    expect(fiche.freqDeclenchementMaxKhz).toBe(180)
    expect(fiche.dureeInterPulsS).toBe(0.1)
    expect(fiche.gainDb).toBe(0)
    expect(fiche.dureeMaxSequenceS).toBe(5)
    expect(fiche.parametreFiltration).toBe('Passe-haut')
    expect(fiche.moulinette).toBe('BatDetect2')
    expect(fiche.destinBruits).toBe('Suppression')
    expect(mapFicheRow('user-a', { id: 'x' }).tauxEchantillonnageKhz).toBeNull()
  })

  it('updates remote metadata through the dedicated RPC', async () => {
    const { client, rpc } = createFakeSupabase(new FakeStore())
    rpc.mockResolvedValue({ data: { status: 'ok', revision: 7 }, error: null })
    createClientMock.mockReturnValue(client)

    const metadata = {
      programmeEnregistrement: ['Du coucher au lever du soleil'],
      tauxEchantillonnageKhz: 500,
      freqDeclenchementMinKhz: null,
      freqDeclenchementMaxKhz: null,
      dureeInterPulsS: null,
      gainDb: null,
      dureeMaxSequenceS: null,
      parametreFiltration: '',
      moulinette: 'Kaleidoscope',
      moulinetteAutre: '',
      destinBruits: 'Parasite',
      destinBruitsAutre: '',
    }
    await expect(updateRemoteFicheMetadata('fiche-1', metadata)).resolves.toBe(7)
    expect(rpc).toHaveBeenCalledWith('update_fiche_metadata', {
      p_fiche_id: 'fiche-1',
      p_snapshot: expect.objectContaining({
        programme_enregistrement: ['Du coucher au lever du soleil'],
        taux_echantillonnage_khz: 500,
        moulinette: 'Kaleidoscope',
        destin_bruits: 'Parasite',
      }),
    })
  })

  it('rejects a refused metadata update', async () => {
    const { client, rpc } = createFakeSupabase(new FakeStore())
    rpc.mockResolvedValue({ data: null, error: { message: 'not supervisor' } })
    createClientMock.mockReturnValue(client)

    await expect(updateRemoteFicheMetadata('fiche-1', makeFiche())).rejects.toThrow('not supervisor')

    rpc.mockResolvedValue({ data: { status: 'forbidden' }, error: null })
    await expect(updateRemoteFicheMetadata('fiche-1', makeFiche())).rejects.toThrow(
      'Mise à jour des métadonnées refusée par le serveur',
    )
  })

  it('lists only the field groups that differ in a conflict', async () => {
    const local = makeFiche()
    const remote = makeFiche({ temperatureC: 25 })
    const conflict = await buildSyncConflict(local, remote)
    expect(conflict.ficheId).toBe('fiche-1')
    expect(conflict.fields.map((field) => field.field)).toEqual(['Météo'])
    expect(await buildSyncConflict(local, makeFiche())).toEqual({
      ficheId: 'fiche-1',
      ficheLabel: '2026-08-14T20:00 — SM4BAT — Étang de la Hulotte',
      fields: [],
    })
  })

  it('reports metadata differences in a conflict', async () => {
    const local = makeFiche()
    const remote = makeFiche({
      tauxEchantillonnageKhz: 500,
      programmeEnregistrement: ['Enregistrements continus'],
    })
    const conflict = await buildSyncConflict(local, remote)
    expect(conflict.fields.map((field) => field.field)).toEqual(['Métadonnées'])
    const metadata = conflict.fields[0]
    expect(metadata.local).toContain('256')
    expect(metadata.remote).toContain('500')
    expect(metadata.remote).toContain('Enregistrements continus')
  })

  it('clears stored conflicts', () => {
    expect(getStoredConflicts()).toEqual([])
    clearStoredConflicts()
    expect(getStoredConflicts()).toEqual([])
  })

  it('pushes a dirty fiche, uploads its photos and clears the dirty flag', async () => {
    const fiche = makeFiche({ dirty: true })
    mocks.idb.getFiches.mockResolvedValue([fiche])
    mocks.idb.getPhotosByFiche.mockResolvedValue([
      makePhoto({ storagePath: 'user-a/fiche-1/0-photo-1.jpg' }),
    ])
    mocks.idb.getPendingPhotos.mockResolvedValue([makePhoto({ storagePath: null, pending: true })])
    const { client, rpc, storageHandlers } = createFakeSupabase(new FakeStore())
    rpc.mockResolvedValue({ data: { status: 'ok', revision: 5 }, error: null })
    createClientMock.mockReturnValue(client)

    const result = await syncAll('user-a')

    expect(result.synced).toBe(1)
    expect(result.errors).toBe(0)
    expect(rpc).toHaveBeenCalledWith('sync_fiche_snapshot', expect.objectContaining({ p_expected_revision: null }))
    expect(storageHandlers.upload).toHaveBeenCalledWith(
      'user-a/fiche-1/0-photo-1.jpg',
      expect.any(Blob),
      { contentType: 'image/jpeg', upsert: true },
    )
    expect(mocks.idb.saveFiche).toHaveBeenCalledWith(
      expect.objectContaining({ dirty: false, lastSyncedRemoteRevision: 5, syncError: null }),
    )
    expect(mocks.idb.savePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ pending: false, storagePath: 'user-a/fiche-1/0-photo-1.jpg' }),
    )
  })

  it('reports a remote failure without marking the fiche synced', async () => {
    const fiche = makeFiche({ dirty: true })
    mocks.idb.getFiches.mockResolvedValue([fiche])
    const { client, rpc } = createFakeSupabase(new FakeStore())
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    createClientMock.mockReturnValue(client)

    const result = await syncAll('user-a')

    expect(result.errors).toBe(1)
    expect(result.failures).toEqual([{ ficheId: 'fiche-1', message: 'Échec du snapshot distant' }])
    expect(mocks.idb.saveFiche).toHaveBeenCalledWith(expect.objectContaining({ dirty: true, syncError: 'boom' }))
  })

  it('builds a conflict when the remote revision moved', async () => {
    const local = makeFiche({ dirty: true, lastSyncedRemoteRevision: 1, temperatureC: 18 })
    const remote = makeFiche({ temperatureC: 25 })
    const store = new FakeStore({ fiches: [remoteRow(remote, 4)] })
    mocks.idb.getFiches.mockResolvedValue([local])
    const { client, rpc } = createFakeSupabase(store)
    rpc.mockResolvedValue({ data: { status: 'conflict', revision: 4 }, error: null })
    createClientMock.mockReturnValue(client)

    const result = await syncAll('user-a')

    expect(result.synced).toBe(0)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].fields.map((field) => field.field)).toEqual(['Météo'])
    expect(getStoredConflicts()).toHaveLength(1)
  })

  it('replays tombstones and deletes remote content', async () => {
    const tombstone: FicheTombstone = makeTombstone({ ficheId: 'dead', id: 'user-a:dead' })
    mocks.idb.getTombstones.mockResolvedValue([tombstone])
    mocks.idb.getFiches.mockResolvedValue([])
    const store = new FakeStore({ fiches: [{ id: 'dead', user_id: 'user-a' }] })
    const { client } = createFakeSupabase(store)
    createClientMock.mockReturnValue(client)

    const result = await syncAll('user-a')

    expect(result.deleted).toBe(1)
    expect(mocks.idb.removeTombstone).toHaveBeenCalledWith('user-a', 'dead')
    expect(store.rows.fiches).toHaveLength(0)
  })

  it('pulls remote fiches, skipping unchanged ones and flagging local edits', async () => {
    const fresh = makeFiche({ id: 'f1', siteNom: 'Site A' })
    const same = makeFiche({ id: 'f2', siteNom: 'Site B' })
    const edited = makeFiche({ id: 'f3', siteNom: 'Site C' })
    const store = new FakeStore({
      fiches: [remoteRow(fresh, 1), remoteRow(same, 2), remoteRow(edited, 1)],
      photos: [
        { id: 'rp1', fiche_id: 'f1', user_id: 'user-a', storage_path: 'user-a/f1/0-rp1.jpg', position: 0 },
      ],
    })
    mocks.idb.getFicheById.mockImplementation(async (ownerId: string, id: string) => {
      if (id === 'f2') {
        return makeFiche({ id: 'f2', siteNom: 'Site B', syncedAt: 'x', dirty: false, lastSyncedRemoteRevision: 2 })
      }
      if (id === 'f3') {
        return makeFiche({ id: 'f3', siteNom: 'Site C - édité', dirty: true, lastSyncedRemoteRevision: 1 })
      }
      return undefined
    })
    mocks.idb.getPhotoById.mockResolvedValue(undefined)
    const { client, storageHandlers } = createFakeSupabase(store)
    createClientMock.mockReturnValue(client)

    const result = await pullMyFiches('user-a')

    expect(result.imported).toBe(1)
    expect(result.merged).toBe(0)
    expect(result.conflicts).toHaveLength(1)
    expect(mocks.idb.saveFiche).toHaveBeenCalledTimes(1)
    expect(mocks.idb.saveFiche).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1', dirty: false }))
    expect(storageHandlers.download).toHaveBeenCalled()
    expect(mocks.idb.savePhoto).toHaveBeenCalledWith(expect.objectContaining({ id: 'rp1' }))
  })

  it('caches the fiches of the other recorders with their profile names', async () => {
    const fromBob = makeFiche({ id: 'fa', ownerId: 'user-b', siteNom: 'De Bob' })
    const fromCaro = makeFiche({ id: 'fb', ownerId: 'user-c', siteNom: 'De Caro' })
    const mine = makeFiche({ id: 'fm', ownerId: 'user-a', siteNom: 'À moi' })
    const store = new FakeStore({
      fiches: [remoteRow(fromBob, 1), remoteRow(fromCaro, 1), remoteRow(mine, 1)],
      profiles: [{ id: 'user-b', nom: 'Bob' }],
    })
    const { client } = createFakeSupabase(store)
    createClientMock.mockReturnValue(client)

    const result = await pullAllFichesForSupervisor('user-a')

    expect(result.imported).toBe(2)
    expect(mocks.idb.clearRemoteFiches).toHaveBeenCalledWith('user-a')
    expect(mocks.idb.saveRemoteFiche).toHaveBeenCalledTimes(2)

    const saved: RemoteFicheData[] = []
    mocks.idb.saveRemoteFiche.mockImplementation(async (fiche: RemoteFicheData) => { saved.push(fiche) })
    await pullAllFichesForSupervisor('user-a')

    const bob = saved.find((fiche) => fiche.id === 'fa')
    expect(bob?.userName).toBe('Bob')
    expect(bob?.cachedBy).toBe('user-a')
    const caro = saved.find((fiche) => fiche.id === 'fb')
    expect(caro?.userName).toBeNull()
  })

  it('resolves a conflict by forcing the local snapshot', async () => {
    mocks.idb.getFicheById.mockResolvedValue(makeFiche({ dirty: true }))
    const { client, rpc } = createFakeSupabase(new FakeStore())
    rpc.mockResolvedValue({ data: { status: 'ok', revision: 9 }, error: null })
    createClientMock.mockReturnValue(client)

    await resolveConflict('fiche-1', 'local', 'user-a')

    expect(rpc).toHaveBeenCalledWith('sync_fiche_snapshot', expect.objectContaining({ p_force: true }))
  })

  it('resolves a conflict by adopting the remote fiche', async () => {
    const remote = makeFiche({ siteNom: 'Version distante' })
    const store = new FakeStore({ fiches: [remoteRow(remote, 4)] })
    mocks.idb.getFicheById.mockResolvedValue(makeFiche())
    mocks.idb.getPhotoById.mockResolvedValue(undefined)
    const { client } = createFakeSupabase(store)
    createClientMock.mockReturnValue(client)

    await resolveConflict('fiche-1', 'remote', 'user-a')

    expect(mocks.idb.saveFiche).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fiche-1', siteNom: 'Version distante', dirty: false }),
    )
    expect(getStoredConflicts()).toEqual([])
  })

  it('deletes the remote storage contents and the fiche row', async () => {
    const store = new FakeStore({ fiches: [{ id: 'fiche-1', user_id: 'user-a' }] })
    const { client } = createFakeSupabase(store)
    createClientMock.mockReturnValue(client)

    const status = await deleteFicheFromSupabase('user-a', 'fiche-1')

    expect(status).toBe('ok')
    expect(store.rows.fiches).toHaveLength(0)
  })

  it('creates a signed URL for a stored photo', async () => {
    const { client, storageHandlers } = createFakeSupabase(new FakeStore())
    createClientMock.mockReturnValue(client)

    await expect(getSignedPhotoUrl('user-a/fiche-1/0.jpg')).resolves.toBe('https://signed/url')
    expect(storageHandlers.createSignedUrl).toHaveBeenCalledWith('user-a/fiche-1/0.jpg', 3600)

    storageHandlers.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'denied' } })
    await expect(getSignedPhotoUrl('x')).resolves.toBeNull()
  })

  it('returns the cached remote fiches of the caller', async () => {
    const remote = makeRemoteFiche()
    mocks.idb.getRemoteFiches.mockResolvedValue([remote])

    await expect(fetchRemoteFichesCache('user-a')).resolves.toEqual([remote])
    expect(mocks.idb.getRemoteFiches).toHaveBeenCalledWith('user-a')
  })
})
