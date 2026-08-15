import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CompassField from './compass-field'

describe('CompassField', () => {
  afterEach(cleanup)

  it('renders the label and no value by default', () => {
    render(<CompassField value={null} onChange={() => {}} />)
    expect(screen.getByText("Orientation de l'enregistreur")).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('updates the orientation when the slider moves', () => {
    const onChange = vi.fn()
    render(<CompassField value={null} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '90' } })
    expect(onChange).toHaveBeenCalledWith(90)
  })

  it('displays the current value in degrees', () => {
    render(<CompassField value={180} onChange={() => {}} />)
    expect(screen.getByText('180°')).toBeInTheDocument()
  })

  it('disables the compass button without device orientation support', () => {
    render(<CompassField value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Utiliser la boussole/ })).toBeDisabled()
  })
})
