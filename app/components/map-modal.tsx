'use client'

import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, LocateFixed, MapPin, X } from 'lucide-react'
import { parseWgs84, isValidLat, isValidLon } from '@/lib/geo'
import type { Map as LeafletMapType, Marker as LeafletMarker, LeafletMouseEvent } from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER: [number, number] = [50.85, 4.35]
const DEFAULT_ZOOM = 11

interface MapModalProps {
  lat: number | null
  lon: number | null
  onConfirm: (position: { lat: number; lon: number }) => void
  onClose: () => void
}

export default function MapModal({ lat, lon, onConfirm, onClose }: MapModalProps) {
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(
    lat != null && lon != null && isValidLat(lat) && isValidLon(lon) ? { lat, lon } : null,
  )
  const [pasteValue, setPasteValue] = useState('')
  const [locating, setLocating] = useState(false)
  const [pasteError, setPasteError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handlePaste() {
    const parsed = parseWgs84(pasteValue)
    if (!parsed) {
      setPasteError('Coordonnées illisibles. Essaye « 50.8376, 4.3512 » ou « 50°50\'15"N 4°21\'4"E »')
      return
    }
    setPasteError(null)
    setPosition(parsed)
  }

  function handleLocate() {
    if (!('geolocation' in navigator)) {
      setPasteError('Géolocalisation indisponible sur cet appareil')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lon: result.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocating(false)
        setPasteError('Impossible de récupérer ta position')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-accent" />
            <span className="text-sm font-semibold">Position sur la carte</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
            aria-label="Fermer la carte"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-foreground/10 flex flex-col sm:flex-row gap-2 bg-foreground/[0.02]">
          <div className="relative flex-1">
            <ClipboardPaste size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePaste() }}
              placeholder="Coller des coordonnées WGS84…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-foreground/10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePaste}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-foreground/10 hover:bg-foreground/5 transition-colors cursor-pointer"
            >
              Coller
            </button>
            <button
              type="button"
              onClick={handleLocate}
              disabled={locating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-foreground/10 hover:bg-foreground/5 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <LocateFixed size={13} />
              {locating ? '…' : 'Ma position'}
            </button>
          </div>
        </div>

        {pasteError && (
          <p className="px-5 py-2 text-xs text-red-600">{pasteError}</p>
        )}

        <div className="flex-1 min-h-[300px] relative">
          <LeafletMap
            center={position}
            onChange={(next) => setPosition(next)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-foreground/10">
          <p className="text-xs text-foreground/50 font-mono">
            {position ? `${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}` : 'Clique sur la carte pour placer le point'}
          </p>
          <button
            type="button"
            disabled={!position}
            onClick={() => position && onConfirm(position)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}

function LeafletMap({
  center,
  onChange,
}: {
  center: { lat: number; lon: number } | null
  onChange: (position: { lat: number; lon: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ map: LeafletMapType; marker: LeafletMarker } | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    let active = true
    let map: L.Map | null = null
    let marker: L.Marker | null = null

    import('leaflet').then(({ default: L }) => {
      if (!active || !containerRef.current) return
      map = L.map(containerRef.current, {
        center: center ? [center.lat, center.lon] : DEFAULT_CENTER,
        zoom: center ? 16 : DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      const icon = L.divIcon({
        className: '',
        html: '<div style="width:20px;height:20px;border-radius:50%;background:#c2762a;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      marker = L.marker(center ? [center.lat, center.lon] : DEFAULT_CENTER, {
        icon,
        draggable: true,
      }).addTo(map)

      map.on('click', (event: LeafletMouseEvent) => {
        const next = { lat: event.latlng.lat, lon: event.latlng.lng }
        marker?.setLatLng(event.latlng)
        onChangeRef.current(next)
      })
      marker.on('dragend', () => {
        const latlng = marker?.getLatLng()
        if (latlng) onChangeRef.current({ lat: latlng.lat, lon: latlng.lng })
      })

      mapRef.current = { map, marker }
    })

    return () => {
      active = false
      mapRef.current = null
      map?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const current = mapRef.current
    if (!current || !center) return
    current.marker.setLatLng([center.lat, center.lon])
    current.map.panTo([center.lat, center.lon])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lon])

  return <div ref={containerRef} className="absolute inset-0 z-0" />
}
