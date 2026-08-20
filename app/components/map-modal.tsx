'use client'

import { useEffect, useState } from 'react'
import { ClipboardPaste, LocateFixed, MapPin, X } from 'lucide-react'
import { parseWgs84 } from '@/lib/geo'

interface MapModalProps {
  lat: number | null
  lon: number | null
  onConfirm: (position: { lat: number; lon: number }) => void
  onClose: () => void
}

export default function MapModal({ lat, lon, onConfirm, onClose }: MapModalProps) {
  const [latText, setLatText] = useState(lat != null ? String(lat) : '')
  const [lonText, setLonText] = useState(lon != null ? String(lon) : '')
  const [pasteValue, setPasteValue] = useState('')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function parseNum(raw: string): number | null {
    const normalized = raw.replace(',', '.').trim()
    if (normalized === '') return null
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }

  function handlePaste() {
    const parsed = parseWgs84(pasteValue)
    if (!parsed) {
      setError('Coordonnées illisibles. Essaye « 50.8376, 4.3512 » ou « 50°50\'15"N 4°21\'4"E »')
      return
    }
    setError(null)
    setLatText(String(parsed.lat))
    setLonText(String(parsed.lon))
  }

  function handleLocate() {
    if (!('geolocation' in navigator)) {
      setError('Géolocalisation indisponible sur cet appareil')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLatText(String(result.coords.latitude))
        setLonText(String(result.coords.longitude))
        setLocating(false)
      },
      () => {
        setLocating(false)
        setError('Impossible de récupérer ta position')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function handleConfirm() {
    const latVal = parseNum(latText)
    const lonVal = parseNum(lonText)
    if (latVal == null || lonVal == null) {
      setError('Renseigne latitude et longitude')
      return
    }
    setError(null)
    onConfirm({ lat: latVal, lon: lonVal })
  }

  const hasPosition = parseNum(latText) != null && parseNum(lonText) != null

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-accent" />
            <span className="text-sm font-semibold">Position GPS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Latitude</span>
              <input
                value={latText}
                onChange={(e) => setLatText(e.target.value)}
                placeholder="ex : 50.8376"
                inputMode="decimal"
                className="px-3 py-2 rounded-lg border border-foreground/10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/40 w-full"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Longitude</span>
              <input
                value={lonText}
                onChange={(e) => setLonText(e.target.value)}
                placeholder="ex : 4.3512"
                inputMode="decimal"
                className="px-3 py-2 rounded-lg border border-foreground/10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/40 w-full"
              />
            </label>
          </div>

          <div className="relative">
            <ClipboardPaste size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePaste() }}
              placeholder="Ou coller des coordonnées WGS84…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-foreground/10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/40"
            />
          </div>
          <span className="text-xs text-foreground/50">
            Formats acceptés : 50.8376, 4.3512 / 50,8376 ; 4,3512 / 50°50&apos;15&quot;N 4°21&apos;4&quot;E
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePaste}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/10 hover:bg-foreground/5 transition-colors cursor-pointer"
            >
              <ClipboardPaste size={13} />
              Coller
            </button>
            <button
              type="button"
              onClick={handleLocate}
              disabled={locating}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/10 hover:bg-foreground/5 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <LocateFixed size={13} />
              {locating ? '…' : 'Ma position'}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {hasPosition && (
            <p className="text-xs text-foreground/50 font-mono text-center">
              {Number(parseNum(latText)).toFixed(6)}, {Number(parseNum(lonText)).toFixed(6)}
            </p>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-foreground/10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border border-foreground/10 hover:bg-foreground/5 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!hasPosition}
            onClick={handleConfirm}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}
