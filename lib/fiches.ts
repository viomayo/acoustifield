export const DRAFT_KEY = 'acoustifield_draft_v1'
export const LAST_PROJECT_KEY = 'acoustifield_last_project_v1'

export interface FicheMetadata {
  programmeEnregistrement: string[]
  tauxEchantillonnageKhz: number | null
  freqDeclenchementMinKhz: number | null
  freqDeclenchementMaxKhz: number | null
  dureeInterPulsS: number | null
  gainDb: number | null
  dureeMaxSequenceS: number | null
  parametreFiltration: string
  moulinette: string
  moulinetteAutre: string
  destinBruits: string
  destinBruitsAutre: string
}

export interface FicheData extends FicheMetadata {
  id: string
  ownerId: string
  appareilType: string
  boitierNum: string
  microNum: string
  carteSdPleine: boolean
  projet: string
  operateur: string
  dateHeurePose: string
  dateHeureRecherche: string
  nbNuitsEcoute: number | null
  siteNom: string
  lat: number | null
  lon: number | null
  commune: string
  surElement: string
  surElementAutre: string
  ouverturePaysage: string
  habitatPrincipal: string
  habitatSecondaire: string
  habitatPrincipalAutre: string
  habitatSecondaireAutre: string
  gestion: string
  eclairage: string
  hauteurPoseM: number | null
  orientationDeg: number | null
  temperatureC: number | null
  typeNuit: string
  conditionsMeteo: string[]
  commentaires: string
  createdAt: string
  updatedAt: string
  syncedAt: string | null
  dirty: boolean
  lastSyncedRemoteRevision: number | null
  syncError: string | null
}

export interface FicheDraft extends FicheMetadata {
  id?: string
  appareilType: string
  boitierNum: string
  microNum: string
  carteSdPleine: boolean
  projet: string
  operateur: string
  dateHeurePose: string
  dateHeureRecherche: string
  nbNuitsEcoute: number | null
  siteNom: string
  lat: number | null
  lon: number | null
  commune: string
  surElement: string
  surElementAutre: string
  ouverturePaysage: string
  habitatPrincipal: string
  habitatSecondaire: string
  habitatPrincipalAutre: string
  habitatSecondaireAutre: string
  gestion: string
  eclairage: string
  hauteurPoseM: number | null
  orientationDeg: number | null
  temperatureC: number | null
  typeNuit: string
  conditionsMeteo: string[]
  commentaires: string
  photoCount: number
  createdAt: string
  syncedAt: string | null
  lastSyncedRemoteRevision: number | null
}

export const APPAREILS = [
  'SM4BAT',
  'SM Mini Bat 2',
  'SM5BAT',
  'Batlogger A+',
  'Batlogger M / M2',
  'Audiomoth',
  'Passive Recorder',
] as const

export const SUR_ELEMENTS = [
  'Arbre',
  'Bâtiment',
  'Poteau',
  'Grillage',
  'Autre',
] as const

export const OUVER_TURES_PAYSAGE = [
  'Ouvert',
  'Semi-ouvert',
  'Fermé',
] as const

export const HABITATS = [
  'Cavité - carrière, mine et grotte',
  'Bâtiments',
  "Plan d'eau - mare (< 50m²)",
  "Plan d'eau - étang (>50m²)",
  "Cours d'eau - fleuves et gd rivières (L >10 m)",
  "Cours d'eau - ruisseau (L < 3m)",
  "Cours d'eau - rivière (3m< L< 10m)",
  'Forêt feuillue',
  'Forêt résineuse',
  'Forêt mixte',
  'Mise à blanc',
  'Lisière vraie (milieu ouvert/milieux forestier)',
  'Prairie',
  'Culture',
  'Prairie/culture',
  'Pelouse, Lande',
  'Zone urbanisée (ville , village)',
  'Haie',
  "Bande boisée et alignement d'arbres",
  'Arbre isolé',
  'buissons isolés',
  'Milieux rocheux',
  'Layons',
  'Route (induré, circulation véhicule rapide)',
  'Chemin (induré, circulation véhicule lents)',
  'Sentier (non induré - circulation piétonne)',
  'Autre',
] as const

export const GESTIONS = [
  'Eau - présence de végétation aquatique flottante',
  'Forêt - peuplement avec gros bois ( > 50 cm diam)',
  'Forêt - peuplement jeune ( < 50 cm diam)',
  'Prairie - site pâturé (avec animaux présents)',
  'Prairie - site pâturé (animaux NON présents)',
  'Prairie - site fauché (récemment)',
  'Prairie - site non fauché',
] as const

export const ECLAIRAGES = [
  'Oui',
  'Non',
] as const

export const CONDITIONS_METEO = [
  'Dégagé',
  'Partiellement nuageux',
  'Nuageux',
  'Brouillard',
  'Bruine',
  'Pluie légère',
  'Pluie forte',
  'Orage',
] as const

export const VENTS = [
  'Vent nul',
  'Vent léger',
  'Vent modéré',
  'Vent fort',
] as const

export const LUMINOSITES = [
  'Pleine lune',
  'Croissant de lune',
  'Nuit noire',
] as const

export const PROGRAMMES_ENREGISTREMENT = [
  'Du coucher au lever du soleil',
  '½ h avant le coucher du soleil',
  '½ h après le lever du soleil',
  'Enregistrements continus',
] as const

export const TAUX_ECHANTILLONNAGE_KHZ = [192, 256, 384, 500] as const
export const TAUX_ECHANTILLONNAGE_PAR_DEFAUT = 256

export const MOULINETTES = [
  'SonoChiro',
  'BatDetect2',
  'Kaleidoscope',
  'BattyBirdNet',
  'Autre',
] as const

export const DESTINS_BRUITS = [
  'Suppression',
  'Parasite',
  'Autre',
] as const

export function computeNbNuitsEcoute(pose: string, recherche: string): number | null {
  if (!pose || !recherche) return null
  const d1 = new Date(pose)
  const d2 = new Date(recherche)
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null
  const start = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())
  const end = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate())
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 0
}

export function defaultFiche(ownerId: string): FicheData {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    ownerId,
    appareilType: '',
    boitierNum: '',
    microNum: '',
    carteSdPleine: false,
    projet: '',
    operateur: '',
    dateHeurePose: '',
    dateHeureRecherche: '',
    nbNuitsEcoute: null,
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
    conditionsMeteo: [],
    commentaires: '',
    programmeEnregistrement: [],
    tauxEchantillonnageKhz: TAUX_ECHANTILLONNAGE_PAR_DEFAUT,
    freqDeclenchementMinKhz: null,
    freqDeclenchementMaxKhz: null,
    dureeInterPulsS: null,
    gainDb: null,
    dureeMaxSequenceS: null,
    parametreFiltration: '',
    moulinette: '',
    moulinetteAutre: '',
    destinBruits: '',
    destinBruitsAutre: '',
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    dirty: true,
    lastSyncedRemoteRevision: null,
    syncError: null,
  }
}

export function draftFromFiche(fiche: FicheData, photoCount: number): FicheDraft {
  return {
    id: fiche.id,
    appareilType: fiche.appareilType,
    boitierNum: fiche.boitierNum,
    microNum: fiche.microNum,
    carteSdPleine: fiche.carteSdPleine,
    projet: fiche.projet,
    operateur: fiche.operateur,
    dateHeurePose: fiche.dateHeurePose,
    dateHeureRecherche: fiche.dateHeureRecherche,
    nbNuitsEcoute: fiche.nbNuitsEcoute,
    siteNom: fiche.siteNom,
    lat: fiche.lat,
    lon: fiche.lon,
    commune: fiche.commune,
    surElement: fiche.surElement,
    surElementAutre: fiche.surElementAutre,
    ouverturePaysage: fiche.ouverturePaysage,
    habitatPrincipal: fiche.habitatPrincipal,
    habitatSecondaire: fiche.habitatSecondaire,
    habitatPrincipalAutre: fiche.habitatPrincipalAutre,
    habitatSecondaireAutre: fiche.habitatSecondaireAutre,
    gestion: fiche.gestion,
    eclairage: fiche.eclairage,
    hauteurPoseM: fiche.hauteurPoseM,
    orientationDeg: fiche.orientationDeg,
    temperatureC: fiche.temperatureC,
    typeNuit: fiche.typeNuit,
    conditionsMeteo: fiche.conditionsMeteo,
    commentaires: fiche.commentaires,
    programmeEnregistrement: fiche.programmeEnregistrement,
    tauxEchantillonnageKhz: fiche.tauxEchantillonnageKhz,
    freqDeclenchementMinKhz: fiche.freqDeclenchementMinKhz,
    freqDeclenchementMaxKhz: fiche.freqDeclenchementMaxKhz,
    dureeInterPulsS: fiche.dureeInterPulsS,
    gainDb: fiche.gainDb,
    dureeMaxSequenceS: fiche.dureeMaxSequenceS,
    parametreFiltration: fiche.parametreFiltration,
    moulinette: fiche.moulinette,
    moulinetteAutre: fiche.moulinetteAutre,
    destinBruits: fiche.destinBruits,
    destinBruitsAutre: fiche.destinBruitsAutre,
    photoCount,
    createdAt: fiche.createdAt,
    syncedAt: fiche.syncedAt,
    lastSyncedRemoteRevision: fiche.lastSyncedRemoteRevision,
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function loadDraft(): Partial<FicheDraft> | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      ...(isString(parsed.id) && parsed.id ? { id: parsed.id } : {}),
      appareilType: isString(parsed.appareilType) ? parsed.appareilType : '',
      boitierNum: isString(parsed.boitierNum) ? parsed.boitierNum : '',
      microNum: isString(parsed.microNum) ? parsed.microNum : '',
      carteSdPleine: parsed.carteSdPleine === true,
      projet: isString(parsed.projet) ? parsed.projet : '',
      operateur: isString(parsed.operateur) ? parsed.operateur : '',
      dateHeurePose: isString(parsed.dateHeurePose) ? parsed.dateHeurePose : '',
      dateHeureRecherche: isString(parsed.dateHeureRecherche) ? parsed.dateHeureRecherche : '',
      nbNuitsEcoute: typeof parsed.nbNuitsEcoute === 'number' ? parsed.nbNuitsEcoute : null,
      siteNom: isString(parsed.siteNom) ? parsed.siteNom : '',
      lat: typeof parsed.lat === 'number' && Number.isFinite(parsed.lat) ? parsed.lat : null,
      lon: typeof parsed.lon === 'number' && Number.isFinite(parsed.lon) ? parsed.lon : null,
      commune: isString(parsed.commune) ? parsed.commune : '',
      surElement: isString(parsed.surElement) ? parsed.surElement : '',
      surElementAutre: isString(parsed.surElementAutre) ? parsed.surElementAutre : '',
      ouverturePaysage: isString(parsed.ouverturePaysage) ? parsed.ouverturePaysage : '',
      habitatPrincipal: isString(parsed.habitatPrincipal) ? parsed.habitatPrincipal : '',
      habitatSecondaire: isString(parsed.habitatSecondaire) ? parsed.habitatSecondaire : '',
      habitatPrincipalAutre: isString(parsed.habitatPrincipalAutre) ? parsed.habitatPrincipalAutre : '',
      habitatSecondaireAutre: isString(parsed.habitatSecondaireAutre) ? parsed.habitatSecondaireAutre : '',
      gestion: isString(parsed.gestion) ? parsed.gestion : '',
      eclairage: isString(parsed.eclairage) ? parsed.eclairage : '',
      hauteurPoseM: typeof parsed.hauteurPoseM === 'number' && Number.isFinite(parsed.hauteurPoseM) ? parsed.hauteurPoseM : null,
      orientationDeg: typeof parsed.orientationDeg === 'number' && Number.isFinite(parsed.orientationDeg) ? parsed.orientationDeg : null,
      temperatureC: typeof parsed.temperatureC === 'number' && Number.isFinite(parsed.temperatureC) ? parsed.temperatureC : null,
      typeNuit: isString(parsed.typeNuit) ? parsed.typeNuit : '',
      conditionsMeteo: Array.isArray(parsed.conditionsMeteo) ? (parsed.conditionsMeteo as unknown[]).filter(isString) : [],
      commentaires: isString(parsed.commentaires) ? parsed.commentaires : '',
      programmeEnregistrement: Array.isArray(parsed.programmeEnregistrement) ? (parsed.programmeEnregistrement as unknown[]).filter(isString) : [],
      tauxEchantillonnageKhz: typeof parsed.tauxEchantillonnageKhz === 'number' && Number.isFinite(parsed.tauxEchantillonnageKhz) ? parsed.tauxEchantillonnageKhz : null,
      freqDeclenchementMinKhz: typeof parsed.freqDeclenchementMinKhz === 'number' && Number.isFinite(parsed.freqDeclenchementMinKhz) ? parsed.freqDeclenchementMinKhz : null,
      freqDeclenchementMaxKhz: typeof parsed.freqDeclenchementMaxKhz === 'number' && Number.isFinite(parsed.freqDeclenchementMaxKhz) ? parsed.freqDeclenchementMaxKhz : null,
      dureeInterPulsS: typeof parsed.dureeInterPulsS === 'number' && Number.isFinite(parsed.dureeInterPulsS) ? parsed.dureeInterPulsS : null,
      gainDb: typeof parsed.gainDb === 'number' && Number.isFinite(parsed.gainDb) ? parsed.gainDb : null,
      dureeMaxSequenceS: typeof parsed.dureeMaxSequenceS === 'number' && Number.isFinite(parsed.dureeMaxSequenceS) ? parsed.dureeMaxSequenceS : null,
      parametreFiltration: isString(parsed.parametreFiltration) ? parsed.parametreFiltration : '',
      moulinette: isString(parsed.moulinette) ? parsed.moulinette : '',
      moulinetteAutre: isString(parsed.moulinetteAutre) ? parsed.moulinetteAutre : '',
      destinBruits: isString(parsed.destinBruits) ? parsed.destinBruits : '',
      destinBruitsAutre: isString(parsed.destinBruitsAutre) ? parsed.destinBruitsAutre : '',
      photoCount: typeof parsed.photoCount === 'number' ? parsed.photoCount : 0,
      ...(isString(parsed.createdAt) ? { createdAt: parsed.createdAt } : {}),
      ...(isString(parsed.syncedAt) ? { syncedAt: parsed.syncedAt } : {}),
      ...(typeof parsed.lastSyncedRemoteRevision === 'number' ? { lastSyncedRemoteRevision: parsed.lastSyncedRemoteRevision } : {}),
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: FicheDraft): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function clearDraft(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(DRAFT_KEY)
}

export function getLastProject(): string {
  if (typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(LAST_PROJECT_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveLastProject(projet: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (projet.trim()) localStorage.setItem(LAST_PROJECT_KEY, projet)
    else localStorage.removeItem(LAST_PROJECT_KEY)
  } catch {
    // stockage indisponible — ignoré
  }
}

export function clearLastProject(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(LAST_PROJECT_KEY)
  } catch {
    // stockage indisponible — ignoré
  }
}

export function metadataIsEmpty(metadata: Partial<FicheMetadata>): boolean {
  return !(
    (metadata.programmeEnregistrement?.length ?? 0) > 0 ||
    (metadata.tauxEchantillonnageKhz != null && metadata.tauxEchantillonnageKhz !== TAUX_ECHANTILLONNAGE_PAR_DEFAUT) ||
    metadata.freqDeclenchementMinKhz != null ||
    metadata.freqDeclenchementMaxKhz != null ||
    metadata.dureeInterPulsS != null ||
    metadata.gainDb != null ||
    metadata.dureeMaxSequenceS != null ||
    metadata.parametreFiltration ||
    metadata.moulinette ||
    metadata.moulinetteAutre ||
    metadata.destinBruits ||
    metadata.destinBruitsAutre
  )
}

export function ficheIsEmpty(draft: Partial<FicheDraft>): boolean {
  return !(
    draft.appareilType ||
    draft.boitierNum ||
    draft.microNum ||
    draft.projet ||
    draft.operateur ||
    draft.dateHeurePose ||
    draft.dateHeureRecherche ||
    draft.siteNom ||
    draft.lat != null ||
    draft.lon != null ||
    draft.commune ||
    draft.surElement ||
    draft.surElementAutre ||
    draft.ouverturePaysage ||
    draft.habitatPrincipal ||
    draft.habitatSecondaire ||
    draft.habitatPrincipalAutre ||
    draft.habitatSecondaireAutre ||
    draft.gestion ||
    draft.eclairage ||
    draft.hauteurPoseM != null ||
    draft.orientationDeg != null ||
    draft.temperatureC != null ||
    draft.typeNuit ||
    (draft.conditionsMeteo && draft.conditionsMeteo.length > 0) ||
    draft.commentaires ||
    (draft.photoCount ?? 0) > 0 ||
    !metadataIsEmpty(draft)
  )
}

export { parseCoordinates } from './geo'
