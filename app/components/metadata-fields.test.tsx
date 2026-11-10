import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MetadataFields, { FrequencyWindowField } from './metadata-fields'
import type { FicheMetadata } from '@/lib/fiches'

const base: FicheMetadata = {
  programmeEnregistrement: [],
  tauxEchantillonnageKhz: 256,
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
}

describe('MetadataFields', () => {
  afterEach(cleanup)

  it('renders the three metadata groups', () => {
    render(<MetadataFields metadata={base} onChange={() => {}} />)
    expect(screen.getByText("Programme d'enregistrement")).toBeInTheDocument()
    expect(screen.getByText('Collecte de données')).toBeInTheDocument()
    expect(screen.getByText(/Filtrage \/ séquençage des données/)).toBeInTheDocument()
  })

  it('shows the default sampling rate and selects another one on click', () => {
    const onChange = vi.fn()
    render(<MetadataFields metadata={base} onChange={onChange} />)
    expect(screen.getByText('256 kHz (par défaut)')).toBeInTheDocument()
    fireEvent.click(screen.getByText('384 kHz'))
    expect(onChange).toHaveBeenCalledWith('tauxEchantillonnageKhz', 384)
  })

  it('toggles a recording programme chip', () => {
    const onChange = vi.fn()
    render(<MetadataFields metadata={base} onChange={onChange} />)
    fireEvent.click(screen.getByText('Enregistrements continus'))
    expect(onChange).toHaveBeenCalledWith('programmeEnregistrement', ['Enregistrements continus'])
  })

  it('reveals the free text input when the moulinette is Autre', () => {
    const onChange = vi.fn()
    render(<MetadataFields metadata={{ ...base, moulinette: 'Autre' }} onChange={onChange} />)
    const input = screen.getByLabelText('Précise la moulinette')
    fireEvent.change(input, { target: { value: 'Chirosoft' } })
    expect(onChange).toHaveBeenCalledWith('moulinetteAutre', 'Chirosoft')
  })

  it('fires a numeric change when a slider moves', () => {
    const onChange = vi.fn()
    render(<MetadataFields metadata={base} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Durée inter-puls' }), { target: { value: '2.5' } })
    expect(onChange).toHaveBeenCalledWith('dureeInterPulsS', 2.5)
  })

  it('shows an em dash for unset sliders', () => {
    render(<MetadataFields metadata={base} onChange={() => {}} />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })
})

describe('FrequencyWindowField', () => {
  afterEach(cleanup)

  it('opens the window at 0 – 180 when dragging the min thumb first', () => {
    const onChange = vi.fn()
    render(<FrequencyWindowField min={null} max={null} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Fréquence min de déclenchement (kHz)' }), { target: { value: '30' } })
    expect(onChange).toHaveBeenCalledWith(30, 180)
  })

  it('closes the window at 0 when dragging the max thumb first', () => {
    const onChange = vi.fn()
    render(<FrequencyWindowField min={null} max={null} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Fréquence max de déclenchement (kHz)' }), { target: { value: '120' } })
    expect(onChange).toHaveBeenCalledWith(0, 120)
  })

  it('keeps the two thumbs ordered within a defined window', () => {
    const onChange = vi.fn()
    render(<FrequencyWindowField min={20} max={120} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Fréquence min de déclenchement (kHz)' }), { target: { value: '150' } })
    expect(onChange).toHaveBeenCalledWith(120, 120)
    fireEvent.change(screen.getByRole('slider', { name: 'Fréquence max de déclenchement (kHz)' }), { target: { value: '10' } })
    expect(onChange).toHaveBeenCalledWith(20, 20)
  })

  it('displays the window and clears it via the Effacer button', () => {
    const onChange = vi.fn()
    render(<FrequencyWindowField min={20} max={120} onChange={onChange} />)
    expect(screen.getByText('20 – 120 kHz')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Effacer'))
    expect(onChange).toHaveBeenCalledWith(null, null)
  })

  it('shows no value and no clear button when unset', () => {
    render(<FrequencyWindowField min={null} max={null} onChange={() => {}} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Effacer')).not.toBeInTheDocument()
  })
})
