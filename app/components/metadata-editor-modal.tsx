'use client'

import { useState } from 'react'
import { Save, X } from 'lucide-react'
import MetadataFields from './metadata-fields'
import { updateRemoteFicheMetadata } from '@/lib/supabase/sync'
import { saveRemoteFiche, type RemoteFicheData } from '@/lib/idb'
import type { FicheMetadata } from '@/lib/fiches'
import { showToast } from '@/lib/toast'

export default function MetadataEditorModal({
  fiche,
  onClose,
  onSaved,
}: {
  fiche: RemoteFicheData
  onClose: () => void
  onSaved: () => void
}) {
  const [metadata, setMetadata] = useState<FicheMetadata>(() => ({
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
  }))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const revision = await updateRemoteFicheMetadata(fiche.id, metadata)
      await saveRemoteFiche({
        ...fiche,
        ...metadata,
        updatedAt: new Date().toISOString(),
        lastSyncedRemoteRevision: revision,
      })
      showToast('Métadonnées enregistrées', 'success')
      onSaved()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Échec de l’enregistrement des métadonnées', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center pt-8 sm:pt-12 bg-black/50 overflow-y-auto">
      <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-semibold truncate">
              Métadonnées · {fiche.siteNom || 'Fiche'}
            </span>
            <span className="text-xs text-foreground/50 truncate">
              {[fiche.userName, fiche.projet, fiche.dateHeurePose].filter(Boolean).join(' · ')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MetadataFields
            metadata={metadata}
            onChange={(key, value) => setMetadata((prev) => ({ ...prev, [key]: value }))}
          />
        </div>

        <div className="px-5 py-4 border-t border-foreground/10 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-foreground/10 hover:bg-foreground/5 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Save size={13} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
