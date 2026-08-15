'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Images, Loader2, Trash2 } from 'lucide-react'
import { getPhotosByFiche, savePhoto, deletePhoto, type PhotoData } from '@/lib/idb'
import { resizeImageToJpeg } from '@/lib/photos'
import { showToast } from '@/lib/toast'

interface PhotoFieldProps {
  ficheId: string
  ownerId: string
  onChange: (photos: PhotoData[]) => void
}

export default function PhotoField({ ficheId, ownerId, onChange }: PhotoFieldProps) {
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [busy, setBusy] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const list = await getPhotosByFiche(ownerId, ficheId)
    setPhotos(list)
    onChange(list)
  }, [ownerId, ficheId, onChange])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(initial)
  }, [refresh])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const existing = await getPhotosByFiche(ownerId, ficheId)
      let position = existing.length
      for (const file of files) {
        const blob = await resizeImageToJpeg(file)
        const photo: PhotoData = {
          id: crypto.randomUUID(),
          ficheId,
          ownerId,
          blob,
          mimeType: 'image/jpeg',
          position,
          storagePath: null,
          uploadedAt: null,
          pending: true,
          createdAt: new Date().toISOString(),
        }
        try {
          await savePhoto(photo)
          position += 1
        } catch {
          showToast('Stockage local plein — photo ignorée', 'error')
          break
        }
      }
      await refresh()
      if (files.length > 0) showToast('Photo(s) enregistrée(s) en local', 'success')
    } finally {
      setBusy(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  async function handleRemove(photoId: string) {
    await deletePhoto(ownerId, photoId)
    const remaining = await getPhotosByFiche(ownerId, ficheId)
    const reindexed = remaining.map((photo, index) => ({ ...photo, position: index }))
    for (const photo of reindexed) await savePhoto(photo)
    setPhotos(reindexed)
    onChange(reindexed)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="flex items-center justify-center gap-2 flex-1 px-3 py-2.5 rounded-lg border border-foreground/10 bg-white text-sm font-medium hover:bg-foreground/5 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Camera size={15} className="text-accent" />
          Prendre une photo
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy}
          className="flex items-center justify-center gap-2 flex-1 px-3 py-2.5 rounded-lg border border-foreground/10 bg-white text-sm font-medium hover:bg-foreground/5 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Images size={15} className="text-accent" />}
          Galerie
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative rounded-lg overflow-hidden border border-foreground/10 aspect-square bg-foreground/5 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(photo.blob)}
                alt={`Photo ${photo.position + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {photo.pending && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-400/90 text-white">
                  hors ligne
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleRemove(photo.id)}
                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                aria-label="Supprimer la photo"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
