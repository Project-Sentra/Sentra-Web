import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ProgressBar from '../ProgressBar'

describe('ProgressBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProgressBar value={50} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('clamps value to 0-100 range', () => {
    const { container } = render(<ProgressBar value={150} />)
    const bar = container.querySelector('[style]')
    expect(bar.style.width).toBe('100%')
  })

  it('handles negative values', () => {
    const { container } = render(<ProgressBar value={-10} />)
    const bar = container.querySelector('[style]')
    expect(bar.style.width).toBe('0%')
  })

  it('defaults to 0 when no value provided', () => {
    const { container } = render(<ProgressBar />)
    const bar = container.querySelector('[style]')
    expect(bar.style.width).toBe('0%')
  })

  it('renders correct percentage', () => {
    const { container } = render(<ProgressBar value={75} />)
    const bar = container.querySelector('[style]')
    expect(bar.style.width).toBe('75%')
  })
})
