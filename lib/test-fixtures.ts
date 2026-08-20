import type { FicheData } from './fiches'
import type { FicheTombstone, PhotoData, RemoteFicheData } from './idb'

export function makeFiche(overrides: Partial<FicheData> = {}): FicheData {
  return {
    id: 'fiche-1',
    ownerId: 'user-a',
    appareilType: 'SM4BAT',
    boitierNum: 'B1',
    microNum: 'M1',
    carteSdPleine: false,
    projet: 'Projet A',
    operateur: 'Opérateur',
    dateHeurePose: '2026-08-14T20:00',
    dateHeureRecherche: '2026-08-17T08:00',
    nbNuitsEcoute: 3,
    siteNom: 'Étang de la Hulotte',
    lat: 50.8333,
    lon: 4.4667,
    commune: 'Bruxelles',
    surElement: 'Arbre',
    surElementAutre: '',
    ouverturePaysage: 'Ouvert',
    habitatPrincipal: 'Bois / forêt',
    habitatSecondaire: 'Lisière',
    habitatPrincipalAutre: '',
    habitatSecondaireAutre: '',
    gestion: 'Aucune',
    eclairage: 'Aucun',
    hauteurPoseM: 3.5,
    orientationDeg: null,
    temperatureC: 18,
    typeNuit: 'Chaude et humide',
    conditionsMeteo: ['Pluie', 'Vent'],
    commentaires: 'Accès par le sentier',
    createdAt: '2026-08-14T20:00:00.000Z',
    updatedAt: '2026-08-14T21:00:00.000Z',
    syncedAt: null,
    dirty: true,
    lastSyncedRemoteRevision: null,
    syncError: null,
    ...overrides,
  }
}

export function makePhoto(overrides: Partial<PhotoData> = {}): PhotoData {
  return {
    id: 'photo-1',
    ficheId: 'fiche-1',
    ownerId: 'user-a',
    blob: new Blob(['fake-jpeg'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    position: 0,
    storagePath: null,
    uploadedAt: null,
    pending: true,
    createdAt: '2026-08-14T20:05:00.000Z',
    ...overrides,
  }
}

export function makeTombstone(overrides: Partial<FicheTombstone> = {}): FicheTombstone {
  return {
    id: 'user-a:fiche-1',
    ficheId: 'fiche-1',
    ownerId: 'user-a',
    deletedAt: '2026-08-14T22:00:00.000Z',
    lastError: null,
    ...overrides,
  }
}

export function makeRemoteFiche(overrides: Partial<RemoteFicheData> = {}): RemoteFicheData {
  const base = makeFiche()
  return {
    ...base,
    userId: base.ownerId,
    userName: null,
    cachedBy: 'user-a',
    photos: [],
    ...overrides,
  }
}
