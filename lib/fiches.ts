export const DRAFT_KEY = 'acoustifield_draft_v1'
export const LAST_PROJECT_KEY = 'acoustifield_last_project_v1'

export interface FicheData {
  id: string
  ownerId: string
  appareilType: string
  boitierNum: string
  microNum: string
  carteSdPleine: boolean
  projet: string
  operateur: string
  dateDebutNuit: string
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

export interface FicheDraft {
  id?: string
  appareilType: string
  boitierNum: string
  microNum: string
  carteSdPleine: boolean
  projet: string
  operateur: string
  dateDebutNuit: string
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
  'Prairie - site fauché (récemment)',
  'Prairie - site non fauché',
] as const

export const ECLAIRAGES = [
  'Oui',
  'Non',
] as const

export const TYPES_NUIT = [
  'Calme',
  'Pluvieuse',
  'Orageuse',
] as const

export const CONDITIONS_METEO = [
  'Dégagé',
  'Couvert',
  'Nuageux',
  'Brouillard',
  'Bruine',
  'Pluie légère',
  'Pleine lune',
  'Nuit noire',
  'Vent léger',
  'Vent fort',
] as const

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
    dateDebutNuit: '',
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
    dateDebutNuit: fiche.dateDebutNuit,
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
    photoCount,
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
      dateDebutNuit: isString(parsed.dateDebutNuit) ? parsed.dateDebutNuit : '',
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
      photoCount: typeof parsed.photoCount === 'number' ? parsed.photoCount : 0,
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

export function ficheIsEmpty(draft: Partial<FicheDraft>): boolean {
  return !(
    draft.appareilType ||
    draft.boitierNum ||
    draft.microNum ||
    draft.projet ||
    draft.operateur ||
    draft.dateDebutNuit ||
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
    (draft.photoCount ?? 0) > 0
  )
}

const COORD_TOKEN_RE =
  /([+-]?\d+(?:[.,]\d+)?)\s*(?:°\s*)?(?:\s*(\d+(?:[.,]\d+)?)\s*['′’]\s*)?(?:\s*(\d+(?:[.,]\d+)?)\s*(?:["″”]))?\s*([NSEWnsew])?/g

function coordValue(match: RegExpMatchArray): number {
  const deg = Number(match[1].replace(',', '.'))
  const min = match[2] ? Number(match[2].replace(',', '.')) : 0
  const sec = match[3] ? Number(match[3].replace(',', '.')) : 0
  return deg + min / 60 + sec / 3600
}

function applyDirection(value: number, dir?: string): number {
  if (!dir) return value
  if (dir === 'N' || dir === 'E') return Math.abs(value)
  if (dir === 'S' || dir === 'W') return -Math.abs(value)
  return value
}

export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const text = input.trim()
  if (!text) return null

  const matches = Array.from(text.matchAll(COORD_TOKEN_RE)).filter((m) => m[1] !== undefined)
  if (matches.length !== 2) return null

  const first = matches[0]
  const second = matches[1]
  const dir0 = first[4] ? first[4].toUpperCase() : undefined
  const dir1 = second[4] ? second[4].toUpperCase() : undefined
  const hasLatDir = dir0 === 'N' || dir0 === 'S' || dir1 === 'N' || dir1 === 'S'
  const hasLonDir = dir0 === 'E' || dir0 === 'W' || dir1 === 'E' || dir1 === 'W'

  let lat: number
  let lon: number
  if (hasLatDir && hasLonDir) {
    const latMatch = dir0 === 'N' || dir0 === 'S' ? first : second
    const lonMatch = dir0 === 'E' || dir0 === 'W' ? first : second
    lat = applyDirection(coordValue(latMatch), latMatch[4])
    lon = applyDirection(coordValue(lonMatch), lonMatch[4])
  } else {
    lat = applyDirection(coordValue(first), dir0)
    lon = applyDirection(coordValue(second), dir1)
  }

  return { lat, lon }
}
