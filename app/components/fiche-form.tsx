'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, RotateCcw, Save } from 'lucide-react'
import { useOfflineAuth } from './offline-auth-provider'
import PhotoField from './photo-field'
import MapModal from './map-modal'
import CompassField from './compass-field'
import {
  APPAREILS,
  CONDITIONS_METEO,
  ECLAIRAGES,
  GESTIONS,
  HABITATS,
  OUVER_TURES_PAYSAGE,
  SUR_ELEMENTS,
  TYPES_NUIT,
  clearDraft,
  clearLastProject,
  computeNbNuitsEcoute,
  defaultFiche,
  draftFromFiche,
  ficheIsEmpty,
  getLastProject,
  loadDraft,
  saveDraft,
  saveLastProject,
  type FicheData,
  type FicheDraft,
} from '@/lib/fiches'
import { saveFiche, type PhotoData } from '@/lib/idb'
import { reverseGeocode } from '@/lib/geo'
import { showToast } from '@/lib/toast'

function parseNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  if (normalized === '') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-foreground/10 bg-white p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h2>
        {description && <p className="text-xs text-foreground/50">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  inputMode,
  step,
  min,
  max,
  readOnly,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  hint?: string
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'email'
  step?: string
  min?: string
  max?: string
  readOnly?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        step={step}
        min={min}
        max={max}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-foreground/10 bg-white text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/40 w-full read-only:bg-foreground/5 read-only:cursor-default"
      />
      {hint && <span className="text-xs text-foreground/50">{hint}</span>}
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = '—',
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-foreground/10 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/40 w-full"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  multi = false,
  gridClassName,
}: {
  label: string
  options: readonly string[]
  value: string | string[]
  onChange: (next: string | string[]) => void
  multi?: boolean
  gridClassName?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className={gridClassName ?? 'flex flex-wrap gap-1.5'}>
        {options.map((option) => {
          const selected = multi
            ? (value as string[]).includes(option)
            : value === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (multi) {
                  const current = value as string[]
                  onChange(
                    current.includes(option)
                      ? current.filter((item) => item !== option)
                      : [...current, option],
                  )
                } else {
                  onChange(value === option ? '' : option)
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer flex-1 whitespace-nowrap ${
                selected
                  ? 'bg-accent text-white border-accent'
                  : 'border-foreground/15 bg-white text-foreground hover:border-foreground/40'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function FicheForm() {
  const { user } = useOfflineAuth()
  const ownerId = user?.ownerId ?? ''
  const [initialDraft] = useState<Partial<FicheDraft> | null>(() => loadDraft())
  const [fiche, setFiche] = useState<FicheData>(() => {
    const base = defaultFiche(ownerId || 'preview')
    if (initialDraft) {
      return { ...base, ...initialDraft, createdAt: base.createdAt, updatedAt: base.updatedAt }
    }
    base.projet = getLastProject()
    return base
  })
  const [photoCount, setPhotoCount] = useState<number>(() => initialDraft?.photoCount ?? 0)
  const [showMap, setShowMap] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [reverseGeocoding, setReverseGeocoding] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)
  const [latText, setLatText] = useState<string>(() => (fiche.lat == null ? '' : String(fiche.lat)))
  const [lonText, setLonText] = useState<string>(() => (fiche.lon == null ? '' : String(fiche.lon)))
  const [hauteurText, setHauteurText] = useState<string>(() => (fiche.hauteurPoseM == null ? '' : String(fiche.hauteurPoseM)))
  const [temperatureText, setTemperatureText] = useState<string>(() => (fiche.temperatureC == null ? '' : String(fiche.temperatureC)))
  const reverseGeocodeRequested = useRef(false)

  useEffect(() => {
    if (!ownerId || fiche.ownerId === 'preview') return
    if (savedOnce && ficheIsEmpty(fiche)) {
      clearDraft()
      return
    }
    const timeout = window.setTimeout(() => {
      saveDraft(draftFromFiche(fiche, photoCount))
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [fiche, photoCount, ownerId, savedOnce])

  const update = useCallback(<K extends keyof FicheData>(key: K, value: FicheData[K]) => {
    setFiche((prev) => ({ ...prev, [key]: value, updatedAt: new Date().toISOString() }))
  }, [])

  const [autoFilledFor, setAutoFilledFor] = useState<string | null>(null)
  if (user?.displayName && autoFilledFor !== user.displayName) {
    setAutoFilledFor(user.displayName)
    setFiche((prev) => (prev.operateur ? prev : { ...prev, operateur: user.displayName as string }))
  }

  const hasCoordinates = fiche.lat != null && fiche.lon != null

  useEffect(() => {
    if (!hasCoordinates) return
    if (reverseGeocodeRequested.current) return
    reverseGeocodeRequested.current = true
    setReverseGeocoding(true)
    void reverseGeocode(fiche.lat!, fiche.lon!)
      .then((result) => {
        if (result) update('commune', result.commune)
      })
      .catch(() => undefined)
      .finally(() => setReverseGeocoding(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiche.lat, fiche.lon])

  useEffect(() => {
    const computed = computeNbNuitsEcoute(fiche.dateHeurePose, fiche.dateHeureRecherche)
    if (computed !== fiche.nbNuitsEcoute) {
      setFiche((prev) => ({ ...prev, nbNuitsEcoute: computed, updatedAt: new Date().toISOString() }))
    }
  }, [fiche.dateHeurePose, fiche.dateHeureRecherche, fiche.nbNuitsEcoute])

  async function handleSave() {
    if (!ownerId) return
    const missing: string[] = []
    if (!fiche.projet.trim()) missing.push('le nom du projet')
    if (!fiche.dateHeurePose) missing.push('la date et l\'heure de pose')
    if (!fiche.ouverturePaysage) missing.push("l'ouverture du milieu")
    if (!fiche.habitatPrincipal) missing.push("la description de l'habitat principal")
    if (missing.length > 0) {
      showToast(`Champs obligatoires : ${missing.join(', ')}`, 'error')
      return
    }
    saveLastProject(fiche.projet)
    await saveFiche({ ...fiche, ownerId, dirty: true, syncError: null })
    clearDraft()
    setSavedOnce(true)
    const next = defaultFiche(ownerId)
    next.projet = fiche.projet
    next.operateur = user?.displayName ?? ''
    setFiche(next)
    setPhotoCount(0)
    setLatText('')
    setLonText('')
    setHauteurText('')
    setTemperatureText('')
    reverseGeocodeRequested.current = false
    showToast('Fiche enregistrée en local — pense à synchroniser', 'success')
  }

  function handleReset() {
    clearDraft()
    clearLastProject()
    setSavedOnce(true)
    setFiche(defaultFiche(ownerId))
    setPhotoCount(0)
    setLatText('')
    setLonText('')
    setHauteurText('')
    setTemperatureText('')
    reverseGeocodeRequested.current = false
    showToast('Formulaire réinitialisé', 'info')
  }

  function handlePhotosChange(photos: PhotoData[]) {
    setPhotoCount(photos.length)
  }

  function handleDecimalChange(key: 'hauteurPoseM' | 'temperatureC', raw: string) {
    if (key === 'hauteurPoseM') setHauteurText(raw)
    else setTemperatureText(raw)
    update(key, parseNumber(raw))
  }

  function handleMyPosition() {
    if (!('geolocation' in navigator)) {
      showToast('Géolocalisation non disponible', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        update('lat', lat)
        update('lon', lon)
        setLatText(String(lat))
        setLonText(String(lon))
        showToast('Position détectée', 'success')
      },
      () => {
        showToast('Position impossible', 'error')
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Fiche de pose · enregistreur acoustique</h1>
        <p className="text-sm text-foreground/50">Le brouillon est sauvegardé automatiquement sur cet appareil.</p>
      </header>

      <Section title="Type d'appareil">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {APPAREILS.map((appareil) => (
            <button
              key={appareil}
              type="button"
              onClick={() => update('appareilType', fiche.appareilType === appareil ? '' : appareil)}
              className={`px-2 py-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                fiche.appareilType === appareil
                  ? 'bg-accent text-white border-accent'
                  : 'border-foreground/15 bg-white text-foreground hover:border-foreground/40'
              }`}
            >
              {appareil}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextInput label="N° du boîtier" value={fiche.boitierNum} onChange={(v) => update('boitierNum', v)} />
          <TextInput label="N° du micro" value={fiche.microNum} onChange={(v) => update('microNum', v)} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={fiche.carteSdPleine}
            onChange={(e) => update('carteSdPleine', e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          Carte SD pleine
        </label>
      </Section>

      <Section title="Contexte">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <TextInput label="Projet *" value={fiche.projet} onChange={(v) => update('projet', v)} />
          <TextInput label="Opérateur·trice" value={fiche.operateur} onChange={(v) => update('operateur', v)} placeholder="Prénom Nom" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <TextInput
            label="Jour et heure de pose *"
            type="datetime-local"
            value={fiche.dateHeurePose}
            onChange={(v) => update('dateHeurePose', v)}
          />
          <TextInput
            label="Jour et heure de recherche"
            type="datetime-local"
            value={fiche.dateHeureRecherche}
            onChange={(v) => update('dateHeureRecherche', v)}
          />
        </div>
        {fiche.nbNuitsEcoute != null && (
          <span className="text-xs text-foreground/60">
            Nombre de nuits d&apos;écoute : <strong>{fiche.nbNuitsEcoute}</strong> nuit{fiche.nbNuitsEcoute > 1 ? 's' : ''}
          </span>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <TextInput label="Nom du site" value={fiche.siteNom} onChange={(v) => update('siteNom', v)} placeholder="Ex. étang de la Hulotte" />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-background/40 p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">Localisation *</span>
            <span className="text-xs text-foreground/50">Coordonnées en WGS84 (degrés décimaux)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="Latitude (auto)" value={latText} onChange={() => {}} inputMode="decimal" readOnly />
            <TextInput label="Longitude (auto)" value={lonText} onChange={() => {}} inputMode="decimal" readOnly />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
            >
              📍 Renseigner les coordonnées
            </button>
            <button
              type="button"
              onClick={handleMyPosition}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
            >
              📍 Ma position
            </button>
          </div>
          <TextInput
            label="Commune (auto)"
            value={fiche.commune}
            onChange={(v) => update('commune', v)}
            placeholder={reverseGeocoding ? 'Recherche…' : ''}
          />
        </div>
      </Section>

      <Section title="Caractérisation du milieu" description="Dans l'environnement direct du boîtier (< 10 m).">
        <ChipGroup label="Enregistreur posé sur :" options={SUR_ELEMENTS} value={fiche.surElement} onChange={(v) => update('surElement', v as string)} />
        {fiche.surElement === 'Autre' && (
          <TextInput label="Précise le support" value={fiche.surElementAutre} onChange={(v) => update('surElementAutre', v)} />
        )}
        <ChipGroup label="Ouverture du milieu (< 10 m) *" options={OUVER_TURES_PAYSAGE} value={fiche.ouverturePaysage} onChange={(v) => update('ouverturePaysage', v as string)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SelectField label="Description de l'habitat principal (< 10 m) *" value={fiche.habitatPrincipal} options={HABITATS} onChange={(v) => update('habitatPrincipal', v)} />
          <SelectField label="Description de l'habitat secondaire (< 10 m)" value={fiche.habitatSecondaire} options={HABITATS} onChange={(v) => update('habitatSecondaire', v)} />
        </div>
        {fiche.habitatPrincipal === 'Autre' && (
          <TextInput label="Précise l'habitat principal" value={fiche.habitatPrincipalAutre} onChange={(v) => update('habitatPrincipalAutre', v)} />
        )}
        {fiche.habitatSecondaire === 'Autre' && (
          <TextInput label="Précise l'habitat secondaire" value={fiche.habitatSecondaireAutre} onChange={(v) => update('habitatSecondaireAutre', v)} />
        )}
        <SelectField label="Gestion (< 10 m)" value={fiche.gestion} options={GESTIONS} onChange={(v) => update('gestion', v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ChipGroup label="Éclairage" options={ECLAIRAGES} value={fiche.eclairage} onChange={(v) => update('eclairage', v as string)} />
          <TextInput
            label="Hauteur de pose (m)"
            type="text"
            inputMode="decimal"
            placeholder="ex : 1,5"
            hint="Généralement posé à 1,5 m."
            value={hauteurText}
            onChange={(v) => handleDecimalChange('hauteurPoseM', v)}
          />
        </div>
        <CompassField value={fiche.orientationDeg} onChange={(v) => update('orientationDeg', v)} />
      </Section>

      <Section title="Météo">
        <TextInput
          label="Température en début de nuit (au coucher du soleil, °C)"
          type="text"
          inputMode="decimal"
          value={temperatureText}
          onChange={(v) => handleDecimalChange('temperatureC', v)}
        />
        <ChipGroup label="Type de nuit" options={TYPES_NUIT} value={fiche.typeNuit} onChange={(v) => update('typeNuit', v as string)} />
        <ChipGroup label="Conditions" options={CONDITIONS_METEO} value={fiche.conditionsMeteo} multi onChange={(v) => update('conditionsMeteo', v as string[])} gridClassName="grid grid-cols-2 sm:grid-cols-5 gap-1.5" />
      </Section>

      <Section title="Photos du milieu" description="Utile pour se rappeler du contexte lors de l'analyse des enregistrements.">
        <PhotoField ficheId={fiche.id} ownerId={ownerId || 'preview'} onChange={handlePhotosChange} />
      </Section>

      <Section title="Commentaires">
        <textarea
          aria-label="Commentaires"
          value={fiche.commentaires}
          onChange={(e) => update('commentaires', e.target.value)}
          rows={4}
          placeholder="Remarques, éléments remarquables, accès…"
          className="px-3 py-2 rounded-lg border border-foreground/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-foreground/40 resize-y w-full"
        />
      </Section>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!ownerId}
          className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <Save size={15} />
          Sauvegarder et enregistrer une nouvelle fiche
        </button>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          disabled={!ownerId}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-foreground/15 text-sm font-medium text-foreground/70 hover:bg-foreground/5 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <RotateCcw size={15} />
          Réinitialiser
        </button>
      </div>

      {showMap && (
        <MapModal
          lat={fiche.lat}
          lon={fiche.lon}
          onConfirm={(position) => {
            update('lat', position.lat)
            update('lon', position.lon)
            setLatText(String(position.lat))
            setLonText(String(position.lon))
            setShowMap(false)
          }}
          onClose={() => setShowMap(false)}
        />
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Eraser size={16} className="text-accent" />
              <span className="text-sm font-semibold">Réinitialiser le formulaire ?</span>
            </div>
            <p className="text-sm text-foreground/60">
              Toutes les valeurs saisies et les photos de cette fiche seront effacées. Le brouillon sauvegardé sera supprimé.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-foreground/10 hover:bg-foreground/5 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
