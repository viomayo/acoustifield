import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearLastProject,
  computeNbNuitsEcoute,
  defaultFiche,
  draftFromFiche,
  ficheIsEmpty,
  getLastProject,
  loadDraft,
  metadataIsEmpty,
  parseCoordinates,
  saveDraft,
  saveLastProject,
} from './fiches'
import { parseWgs84 } from './geo'
import { makeFiche } from './test-fixtures'

describe('parseCoordinates', () => {
  it('parses plain decimal coordinates separated by a comma', () => {
    expect(parseCoordinates('50.72521, 4.53803')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('parses decimal coordinates with a French comma separator', () => {
    expect(parseCoordinates('50,72521 4,53803')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('parses decimal coordinates with a semicolon separator and French decimals', () => {
    expect(parseCoordinates('49,709328 ; 5,411535')).toEqual({ lat: 49.709328, lon: 5.411535 })
    expect(parseWgs84('49,709328 ; 5,411535')).toEqual({ lat: 49.709328, lon: 5.411535 })
  })

  it('parses decimal coordinates with degree signs and cardinal directions', () => {
    expect(parseCoordinates('50,72521° N, 4,53803° E')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('parses DMS coordinates with cardinal directions', () => {
    const result = parseCoordinates("50°53'19,7\"N 4°21'50,3\"E")
    expect(result).not.toBeNull()
    expect(result!.lat).toBeCloseTo(50.888806, 5)
    expect(result!.lon).toBeCloseTo(4.363972, 5)
  })

  it('assigns axes by cardinal direction even when longitude comes first', () => {
    const result = parseCoordinates('4,53803° E, 50,72521° N')
    expect(result).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('applies a negative sign for S and W directions', () => {
    expect(parseCoordinates('51.5 S 0.1 W')).toEqual({ lat: -51.5, lon: -0.1 })
  })

  it('parses a single decimal with space separator', () => {
    expect(parseCoordinates('50.72521 4.53803')).toEqual({ lat: 50.72521, lon: 4.53803 })
  })

  it('returns null for empty or invalid input', () => {
    expect(parseCoordinates('')).toBeNull()
    expect(parseCoordinates('   ')).toBeNull()
    expect(parseCoordinates('abc')).toBeNull()
    expect(parseCoordinates('50.72521')).toBeNull()
    expect(parseCoordinates('1 2 3')).toBeNull()
  })
})

describe('computeNbNuitsEcoute', () => {
  it('counts one night per calendar day between pose and retrieval', () => {
    expect(computeNbNuitsEcoute('2026-08-23T20:00', '2026-08-28T08:00')).toBe(5)
  })

  it('ignores the time of day', () => {
    expect(computeNbNuitsEcoute('2026-08-23T08:00', '2026-08-28T20:00')).toBe(5)
  })

  it('returns zero for the same day or a retrieval before the pose', () => {
    expect(computeNbNuitsEcoute('2026-08-23T20:00', '2026-08-23T23:00')).toBe(0)
    expect(computeNbNuitsEcoute('2026-08-28T08:00', '2026-08-23T20:00')).toBe(0)
  })

  it('returns null when a date is missing or invalid', () => {
    expect(computeNbNuitsEcoute('', '2026-08-28T08:00')).toBeNull()
    expect(computeNbNuitsEcoute('2026-08-23T20:00', '')).toBeNull()
    expect(computeNbNuitsEcoute('invalid', '2026-08-28T08:00')).toBeNull()
  })
})

describe('last project', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores and restores the last used project name', () => {
    expect(getLastProject()).toBe('')
    saveLastProject('Plan chiroptères')
    expect(getLastProject()).toBe('Plan chiroptères')
  })

  it('forgets the project when saved empty or cleared', () => {
    saveLastProject('Plan')
    saveLastProject('   ')
    expect(getLastProject()).toBe('')
    saveLastProject('Plan')
    clearLastProject()
    expect(getLastProject()).toBe('')
  })
})
describe('draft', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps the fiche id in the draft so a duplicate can be edited in place', () => {
    const fiche = makeFiche({ id: 'copy-42' })
    saveDraft(draftFromFiche(fiche, 1))
    const draft = loadDraft()
    expect(draft?.id).toBe('copy-42')
    expect(draft?.photoCount).toBe(1)
  })

  it('loads legacy drafts without an id', () => {
    localStorage.setItem('acoustifield_draft_v1', JSON.stringify({ siteNom: 'Ancien site' }))
    const draft = loadDraft()
    expect(draft?.siteNom).toBe('Ancien site')
    expect(draft?.id).toBeUndefined()
  })

  it('preserves sync metadata when editing an existing fiche', () => {
    const fiche = makeFiche({ syncedAt: '2026-08-15T08:00:00.000Z', lastSyncedRemoteRevision: 4 })
    saveDraft(draftFromFiche(fiche, 2))
    const draft = loadDraft()
    expect(draft?.createdAt).toBe(fiche.createdAt)
    expect(draft?.syncedAt).toBe(fiche.syncedAt)
    expect(draft?.lastSyncedRemoteRevision).toBe(4)
  })

  it('round-trips metadata through the draft storage', () => {
    const fiche = makeFiche({
      programmeEnregistrement: ['½ h après le lever du soleil'],
      tauxEchantillonnageKhz: 500,
      freqDeclenchementMinKhz: 15,
      freqDeclenchementMaxKhz: 120,
      dureeInterPulsS: 0.1,
      gainDb: 59.5,
      dureeMaxSequenceS: 5,
      parametreFiltration: 'FIR',
      moulinette: 'BattyBirdNet',
      moulinetteAutre: '',
      destinBruits: 'Autre',
      destinBruitsAutre: 'Archivage',
    })
    saveDraft(draftFromFiche(fiche, 0))
    const draft = loadDraft()
    expect(draft?.programmeEnregistrement).toEqual(['½ h après le lever du soleil'])
    expect(draft?.tauxEchantillonnageKhz).toBe(500)
    expect(draft?.freqDeclenchementMinKhz).toBe(15)
    expect(draft?.freqDeclenchementMaxKhz).toBe(120)
    expect(draft?.dureeInterPulsS).toBe(0.1)
    expect(draft?.gainDb).toBe(59.5)
    expect(draft?.dureeMaxSequenceS).toBe(5)
    expect(draft?.parametreFiltration).toBe('FIR')
    expect(draft?.moulinette).toBe('BattyBirdNet')
    expect(draft?.destinBruits).toBe('Autre')
    expect(draft?.destinBruitsAutre).toBe('Archivage')
  })

  it('loads a legacy draft without metadata with the default sampling rate', () => {
    localStorage.setItem('acoustifield_draft_v1', JSON.stringify({ siteNom: 'Ancien site' }))
    const draft = loadDraft()
    expect(draft?.programmeEnregistrement).toEqual([])
    expect(draft?.tauxEchantillonnageKhz).toBeNull()
    expect(draft?.moulinette).toBe('')
  })
})

describe('metadataIsEmpty', () => {
  it('considers a new fiche with only the default sampling rate as empty', () => {
    expect(metadataIsEmpty(defaultFiche('user-a'))).toBe(true)
    expect(metadataIsEmpty(makeFiche())).toBe(true)
  })

  it('detects any filled metadata field', () => {
    expect(metadataIsEmpty(makeFiche({ programmeEnregistrement: ['Enregistrements continus'] }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ tauxEchantillonnageKhz: 384 }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ freqDeclenchementMinKhz: 20 }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ freqDeclenchementMaxKhz: 120 }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ dureeInterPulsS: 2 }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ gainDb: 10 }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ dureeMaxSequenceS: 5 }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ parametreFiltration: 'FIR' }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ moulinette: 'SonoChiro' }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ moulinetteAutre: 'Chirosoft' }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ destinBruits: 'Suppression' }))).toBe(false)
    expect(metadataIsEmpty(makeFiche({ destinBruitsAutre: 'Archivage' }))).toBe(false)
  })

  it('does not flag a fiche as empty when only metadata is filled', () => {
    const cleared = {
      ...draftFromFiche(makeFiche(), 0),
      appareilType: '',
      boitierNum: '',
      microNum: '',
      projet: '',
      operateur: '',
      dateHeurePose: '',
      dateHeureRecherche: '',
      siteNom: '',
      lat: null,
      lon: null,
      commune: '',
      surElement: '',
      surElementAutre: '',
      ouverturePaysage: '',
      habitatPrincipal: '',
      habitatSecondaire: '',
      habitatPrincipalAutre: '',
      habitatSecondaireAutre: '',
      gestion: '',
      eclairage: '',
      hauteurPoseM: null,
      orientationDeg: null,
      temperatureC: null,
      typeNuit: '',
      conditionsMeteo: [] as string[],
      commentaires: '',
      moulinette: 'SonoChiro',
    }
    expect(ficheIsEmpty(cleared)).toBe(false)
  })
})
