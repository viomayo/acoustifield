'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useOfflineAuth } from './offline-auth-provider'
import {
  deleteFiche,
  getFiches,
  getPhotosByFiche,
  saveFiche,
  savePhoto,
  type FicheData,
  type PhotoData,
  type RemoteFicheData,
} from '@/lib/idb'
import { ficheLabel, getSignedPhotoUrl, pullAllFichesForSupervisor, fetchRemoteFichesCache, type SyncConflict } from '@/lib/supabase/sync'
import { getStoredConflicts } from '@/lib/supabase/sync'
import { draftFromFiche, saveDraft } from '@/lib/fiches'
import {
  buildPhotosZip,
  buildPhotosZipAll,
  buildProjectCsvZip,
  downloadBlob,
  downloadCSV,
  downloadText,
  exportBasename,
  ficheToCSV,
  ficheToJSON,
  fichesToCSV,
  fichesToJSON,
  photoFileName,
  type FicheExportRow,
} from '@/lib/exports'
import { showToast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'

interface LocalRow {
  fiche: FicheData
  photos: PhotoData[]
  conflict?: SyncConflict
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Recapitulatif() {
  const { user, isOnlineAuthenticated } = useOfflineAuth()
  const router = useRouter()
  const ownerId = user?.ownerId ?? ''
  const [rows, setRows] = useState<LocalRow[]>([])
  const [remoteFiches, setRemoteFiches] = useState<RemoteFicheData[]>([])
  const [showRemote, setShowRemote] = useState(false)
  const [supervisor, setSupervisor] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'synced' | 'pending' | 'conflict'>('all')
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<{ fiche: FicheData | RemoteFicheData; photos: PhotoData[]; isRemote: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FicheData | null>(null)

  const checkSupervisor = useCallback(async () => {
    if (!isOnlineAuthenticated) return
    try {
      const { data } = await createClient().rpc('current_user_is_supervisor')
      setSupervisor(data === true)
    } catch {
      setSupervisor(false)
    }
  }, [isOnlineAuthenticated])

  const loadLocal = useCallback(async () => {
    if (!ownerId) return
    const conflicts = getStoredConflicts()
    const fiches = await getFiches(ownerId)
    const loaded = await Promise.all(
      fiches.map(async (fiche) => ({
        fiche,
        photos: await getPhotosByFiche(ownerId, fiche.id),
        conflict: conflicts.find((c) => c.ficheId === fiche.id),
      })),
    )
    setRows(loaded)
  }, [ownerId])

  const loadRemote = useCallback(async () => {
    if (!ownerId) return
    setRemoteFiches(await fetchRemoteFichesCache(ownerId))
  }, [ownerId])

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void checkSupervisor()
      void loadLocal()
      void loadRemote()
    }, 0)
    return () => window.clearTimeout(initial)
  }, [checkSupervisor, loadLocal, loadRemote])

  useEffect(() => {
    const reload = () => { void loadLocal(); void loadRemote() }
    window.addEventListener('synced', reload)
    window.addEventListener('acoustifield-sync-state', reload)
    return () => {
      window.removeEventListener('synced', reload)
      window.removeEventListener('acoustifield-sync-state', reload)
    }
  }, [loadLocal, loadRemote])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === 'synced' && (row.fiche.dirty || row.conflict)) return false
      if (filter === 'pending' && !row.fiche.dirty) return false
      if (filter === 'conflict' && !row.conflict) return false
      if (!query) return true
      const haystack = [
        row.fiche.siteNom,
        row.fiche.projet,
        row.fiche.operateur,
        row.fiche.commune,
        row.fiche.appareilType,
        row.fiche.boitierNum,
        row.fiche.microNum,
        row.fiche.dateHeurePose,
        row.fiche.dateHeureRecherche,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [rows, search, filter])

  const pendingPhotos = useMemo(() => rows.reduce((acc, row) => acc + row.photos.filter((p) => p.pending).length, 0), [rows])

  async function handlePullRemote() {
    if (!ownerId) return
    setLoading(true)
    try {
      await pullAllFichesForSupervisor(ownerId)
      await loadRemote()
      setShowRemote(true)
      showToast('Fiches des enregistreurs chargées', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Échec du chargement', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDuplicate(fiche: FicheData) {
    const photos = await getPhotosByFiche(ownerId, fiche.id)
    const now = new Date().toISOString()
    const copy: FicheData = { ...fiche, id: crypto.randomUUID(), dirty: true, syncedAt: null, lastSyncedRemoteRevision: null, syncError: null, createdAt: now, updatedAt: now }
    await saveFiche(copy)
    for (const photo of photos) {
      await savePhoto({ ...photo, id: crypto.randomUUID(), ficheId: copy.id, position: photo.position, pending: true, storagePath: null, uploadedAt: null, createdAt: now })
    }
    saveDraft(draftFromFiche(copy, photos.length))
    showToast('Fiche dupliquée — prête à être modifiée', 'success')
    router.push('/')
  }

  async function handleDelete(fiche: FicheData) {
    await deleteFiche(ownerId, fiche.id)
    setConfirmDelete(null)
    await loadLocal()
    showToast('Fiche supprimée (sync supprimera le distant)', 'info')
  }

  function handleExportJSON(fiche: FicheData | RemoteFicheData, photos: PhotoData[]) {
    downloadText(ficheToJSON(fiche, photos), `${exportBasename(fiche)}.json`, 'application/json')
  }

  function handleExportCSV(fiche: FicheData | RemoteFicheData, photos: PhotoData[], userName?: string | null) {
    const local = fiche as FicheData
    const csv = ficheToCSV(local, photos.length, { name: userName }, photos.map((p) => photoFileName(local, p.position)))
    downloadCSV(csv, `${exportBasename(local)}.csv`)
  }

  async function handleExportZIP(fiche: FicheData | RemoteFicheData, photos: PhotoData[]) {
    if (photos.length === 0) {
      showToast('Aucune photo locale à exporter', 'info')
      return
    }
    const blob = await buildPhotosZip(fiche as FicheData, photos)
    downloadBlob(blob, `${exportBasename(fiche)} - photos.zip`)
  }

  async function handleExportAllFiches() {
    if (rows.length === 0) return
    const byProject = new Map<string, FicheExportRow[]>()
    for (const { fiche, photos } of rows) {
      const projet = fiche.projet.trim() || 'Sans projet'
      const list = byProject.get(projet) ?? []
      list.push({
        fiche,
        photoCount: photos.length,
        userName: user?.displayName ?? null,
        photoNames: photos.map((p) => photoFileName(fiche, p.position)),
      })
      byProject.set(projet, list)
    }
    const groups = [...byProject.entries()].map(([projet, list]) => ({ projet, csv: fichesToCSV(list) }))
    const blob = await buildProjectCsvZip(groups)
    downloadBlob(blob, `fiches-par-projet-${today()}.zip`)
  }

  function handleExportAllJSON() {
    const json = fichesToJSON(rows.map(({ fiche, photos }) => ({ fiche, photos })))
    downloadText(json, `toutes-les-fiches-${today()}.json`, 'application/json')
  }

  async function handleExportAllZIP() {
    const withPhotos = rows.filter(({ photos }) => photos.length > 0)
    if (withPhotos.length === 0) {
      showToast('Aucune photo locale à exporter', 'info')
      return
    }
    const blob = await buildPhotosZipAll(withPhotos)
    downloadBlob(blob, `toutes-les-fiches-${today()}-photos.zip`)
  }

  function openDetails(row: LocalRow) {
    setDetails({ fiche: row.fiche, photos: row.photos, isRemote: false })
  }

  function openRemoteDetails(fiche: RemoteFicheData) {
    setDetails({ fiche, photos: [], isRemote: true })
  }

  const nPending = rows.filter((row) => row.fiche.dirty).length
  const nConflicts = rows.filter((row) => row.conflict).length

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Récapitulatif des fiches</h1>
        <p className="text-sm text-foreground/50">
          {rows.length} fiche{rows.length > 1 ? 's' : ''} · {nPending} en attente de sync · {nConflicts} conflit{nConflicts > 1 ? 's' : ''}
          {pendingPhotos > 0 && ` · ${pendingPhotos} photo(s) à envoyer`}
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un site, projet, appareil…"
          className="flex-1 px-3 py-2 rounded-lg border border-foreground/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-foreground/40"
        />
        <div className="flex gap-1.5">
          {(['all', 'pending', 'conflict', 'synced'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                filter === key ? 'bg-foreground text-background border-foreground' : 'border-foreground/15 bg-white text-foreground/70'
              }`}
            >
              {key === 'all' ? 'Toutes' : key === 'pending' ? 'En attente' : key === 'conflict' ? 'Conflits' : 'Synchronisées'}
            </button>
          ))}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl border border-foreground/10 bg-white p-3">
          <span className="text-xs font-medium text-foreground/60 flex items-center gap-1.5">
            <Download size={13} className="text-accent" />
            Télécharger les données (un tableau CSV par projet)
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void handleExportAllFiches()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/15 hover:bg-foreground/5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={13} /> Fiches (.zip)
            </button>
            <button
              type="button"
              onClick={handleExportAllJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/15 hover:bg-foreground/5 transition-colors cursor-pointer"
            >
              <FileJson size={13} /> JSON
            </button>
            <button
              type="button"
              onClick={() => void handleExportAllZIP()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/15 hover:bg-foreground/5 transition-colors cursor-pointer"
            >
              <Download size={13} /> Photos (.zip)
            </button>
          </div>
        </div>
      )}

      {supervisor && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-foreground/15 bg-amber-50/70 p-3">
          <div className="flex items-center gap-2 text-sm">
            <FolderOpen size={15} className="text-accent" />
            <span>
              Mode superviseur : {showRemote ? `${remoteFiches.length} fiche(s) des enregistreurs` : 'voir les fiches des enregistreurs'}
            </span>
          </div>
          <div className="flex gap-2">
            {!showRemote ? (
              <button
                type="button"
                onClick={() => void handlePullRemote()}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Upload size={13} />
                {loading ? 'Chargement…' : 'Charger'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowRemote(false)}
                className="px-3 py-2 rounded-lg text-xs font-medium border border-foreground/15 hover:bg-foreground/5 transition-colors cursor-pointer"
              >
                Masquer
              </button>
            )}
          </div>
        </div>
      )}

      {showRemote && (
        <div className="flex flex-col gap-2">
          {remoteFiches.map((fiche) => (
            <RemoteCard key={fiche.id} fiche={fiche} onOpen={() => openRemoteDetails(fiche)} />
          ))}
          {remoteFiches.length === 0 && (
            <p className="text-sm text-foreground/45 py-4 text-center">Aucune fiche d&apos;enregistreur chargée.</p>
          )}
        </div>
      )}

      {!showRemote && (
        <div className="flex flex-col gap-2">
          {filtered.map((row) => (
            <FicheCard
              key={row.fiche.id}
              row={row}
              onOpen={() => openDetails(row)}
              onDuplicate={() => void handleDuplicate(row.fiche)}
              onDelete={() => setConfirmDelete(row.fiche)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-foreground/45 py-4 text-center">
              Aucune fiche. Saisis une première fiche de pose depuis l&apos;onglet « Nouvelle fiche ».
            </p>
          )}
        </div>
      )}

      {details && (
        <DetailsModal
          fiche={details.fiche}
          photos={details.photos}
          isRemote={details.isRemote}
          onClose={() => setDetails(null)}
          onExportJSON={() => handleExportJSON(details.fiche, details.photos)}
          onExportCSV={() => handleExportCSV(details.fiche, details.photos, details.isRemote ? (details.fiche as RemoteFicheData).userName : null)}
          onExportZIP={() => void handleExportZIP(details.fiche, details.photos)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 flex flex-col gap-4">
            <span className="text-sm font-semibold">Supprimer cette fiche ?</span>
            <p className="text-sm text-foreground/60">
              {ficheLabel(confirmDelete)} — la suppression sera propagée à la prochaine synchronisation.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-foreground/10 hover:bg-foreground/5 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(confirmDelete)}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function FicheCard({
  row,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  row: LocalRow
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { fiche, photos, conflict } = row
  const thumbnail = photos[0]

  return (
    <div className="rounded-2xl border border-foreground/10 bg-white p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 flex items-start gap-3 text-left cursor-pointer group"
      >
        <div className="w-16 h-16 rounded-xl bg-foreground/5 flex items-center justify-center overflow-hidden shrink-0 border border-foreground/10">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={URL.createObjectURL(thumbnail.blob)} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera size={18} className="text-foreground/30" />
          )}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">
              {fiche.siteNom || 'Site sans nom'}
            </span>
            {fiche.dirty && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-400/90 text-white">en attente</span>
            )}
            {conflict && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500 text-white">conflit</span>
            )}
            {!fiche.dirty && !conflict && (
              <CheckCircle2 size={12} className="text-emerald-600" />
            )}
          </div>
          <p className="text-xs text-foreground/50">
            {[fiche.dateHeurePose, fiche.appareilType, fiche.projet].filter(Boolean).join(' · ') || 'Fiche'}
          </p>
          <p className="text-xs text-foreground/50">
            {[fiche.operateur, fiche.commune].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-foreground/45 flex items-center gap-1 mt-0.5">
            <Camera size={11} /> {photos.length} photo{photos.length > 1 ? 's' : ''}
            {photos.some((p) => p.pending) && ' · à envoyer'}
            {fiche.syncError && <span className="text-red-600"> · {fiche.syncError}</span>}
          </p>
        </div>
      </button>

      <div className="flex sm:flex-col gap-1.5 items-center sm:items-end">
        <button
          type="button"
          onClick={onOpen}
          className="p-2 rounded-lg text-foreground/45 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
          title="Voir le détail"
        >
          <Eye size={15} />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="p-2 rounded-lg text-foreground/45 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
          title="Dupliquer"
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg text-foreground/45 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          title="Supprimer"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function RemoteCard({ fiche, onOpen }: { fiche: RemoteFicheData; onOpen: () => void }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-white p-3 sm:p-4 flex items-center gap-3">
      <button type="button" onClick={onOpen} className="flex-1 flex items-center gap-3 text-left cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-accent">{fiche.userName?.[0]?.toUpperCase() ?? '?'}</span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold truncate">{fiche.siteNom || 'Site sans nom'}</span>
          <span className="text-xs text-foreground/50">
            {[fiche.userName, fiche.dateHeurePose, fiche.appareilType].filter(Boolean).join(' · ')}
          </span>
          <span className="text-xs text-foreground/45 flex items-center gap-1">
            <Camera size={11} /> {fiche.photos.length} photo{fiche.photos.length > 1 ? 's' : ''}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="p-2 rounded-lg text-foreground/45 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
        title="Voir le détail"
      >
        <Eye size={15} />
      </button>
    </div>
  )
}

function DetailsModal({
  fiche,
  photos,
  isRemote,
  onClose,
  onExportJSON,
  onExportCSV,
  onExportZIP,
}: {
  fiche: FicheData | RemoteFicheData
  photos: PhotoData[]
  isRemote: boolean
  onClose: () => void
  onExportJSON: () => void
  onExportCSV: () => void
  onExportZIP: () => void
}) {
  const [remotePhotoUrls, setRemotePhotoUrls] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!isRemote) return
    const refs = (fiche as RemoteFicheData).photos
    let active = true
    void Promise.all(refs.map(async (ref) => {
      const url = await getSignedPhotoUrl(ref.storagePath)
      if (active && url) setRemotePhotoUrls((prev) => new Map(prev).set(ref.id, url))
    }))
    return () => { active = false }
  }, [fiche, isRemote])

  const remoteRefs = isRemote ? (fiche as RemoteFicheData).photos : []
  const rows: Array<[string, string]> = [
    ['Appareil', fiche.appareilType || '—'],
    ['Boîtier / micro', [fiche.boitierNum, fiche.microNum].filter(Boolean).join(' / ') || '—'],
    ['Carte SD pleine', fiche.carteSdPleine ? 'Oui' : 'Non'],
    ['Projet', fiche.projet || '—'],
    ['Opérateur', fiche.operateur || '—'],
    ['Jour et heure de pose', fiche.dateHeurePose || '—'],
    ['Jour et heure de recherche', fiche.dateHeureRecherche || '—'],
    ['Nombre de nuits d\'écoute', fiche.nbNuitsEcoute != null ? `${fiche.nbNuitsEcoute} nuit${fiche.nbNuitsEcoute > 1 ? 's' : ''}` : '—'],
    ['Position', fiche.lat != null && fiche.lon != null ? `${fiche.lat.toFixed(6)}, ${fiche.lon.toFixed(6)}` : '—'],
    ['Commune', fiche.commune || '—'],
    ['Posé sur', [fiche.surElement, fiche.surElementAutre].filter(Boolean).join(' — ') || '—'],
    ['Ouverture du paysage', fiche.ouverturePaysage || '—'],
    ['Habitat', [fiche.habitatPrincipal, fiche.habitatPrincipalAutre, fiche.habitatSecondaire, fiche.habitatSecondaireAutre].filter(Boolean).join(' / ') || '—'],
    ['Gestion', fiche.gestion || '—'],
    ['Éclairage', fiche.eclairage || '—'],
    ['Hauteur de pose', fiche.hauteurPoseM != null ? `${fiche.hauteurPoseM} m` : '—'],
    ['Orientation', fiche.orientationDeg != null ? `${fiche.orientationDeg}°` : '—'],
    ['Température', fiche.temperatureC != null ? `${fiche.temperatureC} °C` : '—'],
    ['Type de nuit', fiche.typeNuit || '—'],
    ['Conditions', fiche.conditionsMeteo.join(', ') || '—'],
    ['Commentaires', fiche.commentaires || '—'],
  ]

  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center pt-10 sm:pt-16 bg-black/50 overflow-y-auto">
      <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10">
          <span className="text-sm font-semibold">{fiche.siteNom || 'Fiche'}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-foreground/45 whitespace-nowrap">{label}</dt>
                <dd className="text-foreground/85">{value}</dd>
              </div>
            ))}
          </dl>

          {(photos.length > 0 || remoteRefs.length > 0) && (
            <div>
              <p className="text-xs font-medium text-foreground/60 mb-2">Photos</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={photo.id} src={URL.createObjectURL(photo.blob)} alt="" className="rounded-lg border border-foreground/10 aspect-square object-cover w-full" />
                ))}
                {remoteRefs.map((ref) => {
                  const url = remotePhotoUrls.get(ref.id)
                  return url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={ref.id} src={url} alt="" className="rounded-lg border border-foreground/10 aspect-square object-cover w-full" />
                  ) : (
                    <div key={ref.id} className="rounded-lg border border-foreground/10 aspect-square bg-foreground/5 flex items-center justify-center">
                      <AlertTriangle size={14} className="text-foreground/30" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-foreground/10 flex flex-wrap gap-2">
          <button type="button" onClick={onExportJSON} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/15 hover:bg-foreground/5 transition-colors cursor-pointer">
            <FileJson size={13} /> JSON
          </button>
          <button type="button" onClick={onExportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/15 hover:bg-foreground/5 transition-colors cursor-pointer">
            <FileSpreadsheet size={13} /> CSV
          </button>
          <button type="button" onClick={onExportZIP} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/15 hover:bg-foreground/5 transition-colors cursor-pointer">
            <Download size={13} /> Photos (.zip)
          </button>
        </div>
      </div>
    </div>
  )
}
