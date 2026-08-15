'use client'

import { useState } from 'react'

interface CompassFieldProps {
  value: number | null
  onChange: (value: number | null) => void
}

type ExtendedDeviceOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number | null
}

type DeviceOrientationConstructor = (typeof DeviceOrientationEvent) & {
  requestPermission?: () => Promise<string>
}

function headingFromEvent(event: DeviceOrientationEvent): number | null {
  const extended = event as ExtendedDeviceOrientationEvent
  if (typeof extended.webkitCompassHeading === 'number') return extended.webkitCompassHeading
  if (event.absolute && typeof event.alpha === 'number') return event.alpha
  return null
}

const TICKS = Array.from({ length: 12 }, (_, i) => i * 30)

export default function CompassField({ value, onChange }: CompassFieldProps) {
  const [status, setStatus] = useState<'idle' | 'measuring' | 'unavailable'>('idle')
  const degrees = value ?? 0
  const supportsDeviceOrientation =
    typeof window !== 'undefined' && 'DeviceOrientationEvent' in window

  async function captureHeading() {
    const DOE = (window as unknown as { DeviceOrientationEvent?: DeviceOrientationConstructor })
      .DeviceOrientationEvent
    if (!DOE) {
      setStatus('unavailable')
      return
    }
    try {
      if (DOE.requestPermission) {
        const permission = await DOE.requestPermission()
        if (permission !== 'granted') return
      }
    } catch {
      setStatus('unavailable')
      return
    }
    setStatus('measuring')
    const handler = (event: DeviceOrientationEvent) => {
      const heading = headingFromEvent(event)
      if (heading == null) return
      const rounded = Math.round(((heading % 360) + 360) % 360)
      onChange(rounded)
      setStatus('idle')
    }
    window.addEventListener('deviceorientation', handler, { once: true })
    window.setTimeout(() => {
      window.removeEventListener('deviceorientation', handler)
      setStatus('idle')
    }, 10000)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Orientation de l&apos;enregistreur</span>
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
        <div className="w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full text-foreground" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
            {TICKS.map((angle) => {
              const rad = (angle * Math.PI) / 180
              const x1 = 50 + Math.sin(rad) * 38
              const y1 = 50 - Math.cos(rad) * 38
              const x2 = 50 + Math.sin(rad) * 42
              const y2 = 50 - Math.cos(rad) * 42
              return (
                <line
                  key={angle}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="1.5"
                />
              )
            })}
            <text x="50" y="12" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor">N</text>
            <text x="50" y="95" textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity="0.6">S</text>
            <text x="95" y="53" textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity="0.6">E</text>
            <text x="5" y="53" textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity="0.6">O</text>
            <g transform={`rotate(${degrees} 50 50)`}>
              <path d="M50 20 L57 46 L50 42 L43 46 Z" fill="#ef4444" />
              <line x1="50" y1="42" x2="50" y2="72" stroke="currentColor" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />
            </g>
            <circle cx="50" cy="50" r="4" fill="currentColor" />
          </svg>
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 w-full">
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={degrees}
              aria-label="Orientation en degrés"
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1 min-w-0 accent-foreground"
            />
            <span className="text-sm font-semibold tabular-nums w-14 text-right shrink-0">
              {value == null ? '—' : `${value}°`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void captureHeading()}
            disabled={!supportsDeviceOrientation || status === 'measuring'}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 transition-colors cursor-pointer"
          >
            🧭 {status === 'measuring' ? 'Mesure…' : 'Utiliser la boussole'}
          </button>
          {status === 'unavailable' && (
            <span className="text-xs text-foreground/50">
              Boussole indisponible sur cet appareil — règle l&apos;orientation avec le curseur ou une boussole externe.
            </span>
          )}
          <span className="text-xs text-foreground/50">
            Règle le curseur à la main ou utilise la boussole du téléphone pour pointer l&apos;orientation de l&apos;enregistreur.
          </span>
        </div>
      </div>
    </div>
  )
}
