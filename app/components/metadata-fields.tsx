'use client'

import { Eraser } from 'lucide-react'
import { ChipGroup, SelectField, TextInput } from './form-fields'
import {
  DESTINS_BRUITS,
  MOULINETTES,
  PROGRAMMES_ENREGISTREMENT,
  TAUX_ECHANTILLONNAGE_KHZ,
  TAUX_ECHANTILLONNAGE_PAR_DEFAUT,
  type FicheMetadata,
} from '@/lib/fiches'

const FREQ_MAX_KHZ = 180
const FREQ_TICKS = [0, 45, 90, 135, 180]

export function formatFrNumber(value: number): string {
  return String(value).replace('.', ',')
}

function chipClass(selected: boolean): string {
  return `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer flex-1 whitespace-nowrap ${
    selected
      ? 'bg-accent text-white border-accent'
      : 'border-foreground/15 bg-white text-foreground hover:border-foreground/40'
  }`
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  label: string
  value: number | null
  min: number
  max: number
  step: number
  unit: string
  hint?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums shrink-0">
          {value == null ? '—' : `${formatFrNumber(value)} ${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
      {hint && <span className="text-xs text-foreground/50">{hint}</span>}
    </div>
  )
}

export function FrequencyWindowField({
  min,
  max,
  onChange,
}: {
  min: number | null
  max: number | null
  onChange: (min: number | null, max: number | null) => void
}) {
  const defined = min != null && max != null
  const minThumb = min ?? 0
  const maxThumb = max ?? FREQ_MAX_KHZ
  const leftPct = (minThumb / FREQ_MAX_KHZ) * 100
  const rightPct = (maxThumb / FREQ_MAX_KHZ) * 100

  function handleMin(next: number) {
    onChange(Math.min(next, max ?? FREQ_MAX_KHZ), max ?? FREQ_MAX_KHZ)
  }

  function handleMax(next: number) {
    onChange(min ?? 0, Math.max(next, min ?? 0))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">Fréquences min et max de déclenchement</span>
        <span className="text-sm font-semibold tabular-nums shrink-0">
          {defined ? `${min} – ${max} kHz` : '—'}
        </span>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-2 rounded-full bg-foreground/10" />
        {defined && (
          <div
            className="absolute h-2 rounded-full bg-accent"
            style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
          />
        )}
        <input
          type="range"
          min={0}
          max={FREQ_MAX_KHZ}
          step={1}
          value={minThumb}
          aria-label="Fréquence min de déclenchement (kHz)"
          onChange={(e) => handleMin(Number(e.target.value))}
          className="frequency-range absolute inset-x-0 w-full"
        />
        <input
          type="range"
          min={0}
          max={FREQ_MAX_KHZ}
          step={1}
          value={maxThumb}
          aria-label="Fréquence max de déclenchement (kHz)"
          onChange={(e) => handleMax(Number(e.target.value))}
          className="frequency-range absolute inset-x-0 w-full"
        />
      </div>
      <div className="relative flex justify-between text-[10px] text-foreground/40 tabular-nums">
        {FREQ_TICKS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-foreground/50">
          {defined ? 'Fenêtre où le détecteur est actif.' : 'Fais glisser les curseurs pour choisir la fenêtre active.'}
        </span>
        {defined && (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="flex items-center gap-1 text-xs font-medium text-foreground/50 underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer"
          >
            <Eraser size={11} />
            Effacer
          </button>
        )}
      </div>
    </div>
  )
}

export default function MetadataFields({
  metadata,
  onChange,
}: {
  metadata: FicheMetadata
  onChange: <K extends keyof FicheMetadata>(key: K, value: FicheMetadata[K]) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Programme d&apos;enregistrement</h3>
        <ChipGroup
          label="Déclenchement des enregistrements"
          options={PROGRAMMES_ENREGISTREMENT}
          value={metadata.programmeEnregistrement}
          multi
          onChange={(v) => onChange('programmeEnregistrement', v as string[])}
          gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-1.5"
          hint="Choix combinables, par ex. « ½ h avant le coucher » avec « ½ h après le lever »."
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Collecte de données</h3>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">Taux d&apos;échantillonnage</span>
          <div className="grid grid-cols-2 gap-1.5">
            {TAUX_ECHANTILLONNAGE_KHZ.map((taux) => {
              const selected = metadata.tauxEchantillonnageKhz === taux
              return (
                <button
                  key={taux}
                  type="button"
                  onClick={() => onChange('tauxEchantillonnageKhz', taux)}
                  className={chipClass(selected)}
                >
                  {taux} kHz{taux === TAUX_ECHANTILLONNAGE_PAR_DEFAUT ? ' (par défaut)' : ''}
                </button>
              )
            })}
          </div>
        </div>
        <FrequencyWindowField
          min={metadata.freqDeclenchementMinKhz}
          max={metadata.freqDeclenchementMaxKhz}
          onChange={(min, max) => {
            onChange('freqDeclenchementMinKhz', min)
            onChange('freqDeclenchementMaxKhz', max)
          }}
        />
        <SliderField
          label="Durée inter-puls"
          value={metadata.dureeInterPulsS}
          min={0.1}
          max={15}
          step={0.1}
          unit="s"
          hint="De 0,1 à 15 secondes entre les impulsions."
          onChange={(v) => onChange('dureeInterPulsS', v)}
        />
        <SliderField
          label="Gain"
          value={metadata.gainDb}
          min={0}
          max={59.5}
          step={0.5}
          unit="dB"
          hint="De 0 à 59,5 dB par incréments de 0,5 dB."
          onChange={(v) => onChange('gainDb', v)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Filtrage / séquençage des données</h3>
        <SliderField
          label="Durée max des séquences"
          value={metadata.dureeMaxSequenceS}
          min={0.5}
          max={15}
          step={0.5}
          unit="s"
          hint="Généralement 5 secondes maximum."
          onChange={(v) => onChange('dureeMaxSequenceS', v)}
        />
        <TextInput
          label="Paramètre de filtration"
          value={metadata.parametreFiltration}
          onChange={(v) => onChange('parametreFiltration', v)}
          placeholder="Ex. filtre passe-haut 15 kHz"
        />
        <SelectField
          label="Moulinette utilisée"
          value={metadata.moulinette}
          options={MOULINETTES}
          onChange={(v) => onChange('moulinette', v)}
        />
        {metadata.moulinette === 'Autre' && (
          <TextInput
            label="Précise la moulinette"
            value={metadata.moulinetteAutre}
            onChange={(v) => onChange('moulinetteAutre', v)}
          />
        )}
        <ChipGroup
          label="Destin des fichiers « bruits »"
          options={DESTINS_BRUITS}
          value={metadata.destinBruits}
          onChange={(v) => onChange('destinBruits', v as string)}
          gridClassName="grid grid-cols-3 gap-1.5"
        />
        {metadata.destinBruits === 'Autre' && (
          <TextInput
            label="Précise le destin des fichiers « bruits »"
            value={metadata.destinBruitsAutre}
            onChange={(v) => onChange('destinBruitsAutre', v)}
          />
        )}
      </div>
    </div>
  )
}
