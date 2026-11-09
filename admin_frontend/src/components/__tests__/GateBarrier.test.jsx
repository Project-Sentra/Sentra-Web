import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GateBarrier from '../GateBarrier'

describe('GateBarrier', () => {
  it('labels the barrier as closed by default', () => {
    render(<GateBarrier open={false} />)
    expect(screen.getByRole('img', { name: 'Barrier closed' })).toBeInTheDocument()
  })

  it('labels the barrier as open when open', () => {
    render(<GateBarrier open />)
    expect(screen.getByRole('img', { name: 'Barrier open' })).toBeInTheDocument()
  })

  it('rotates the arm up when open', () => {
    const { container } = render(<GateBarrier open />)
    expect(container.querySelector('g').style.transform).toBe('rotate(-78deg)')
  })

  it('keeps the arm down when closed', () => {
    const { container } = render(<GateBarrier open={false} />)
    expect(container.querySelector('g').style.transform).toBe('rotate(0deg)')
  })

  it('uses a green light when open and red when closed', () => {
    const { container, rerender } = render(<GateBarrier open />)
    expect(container.querySelector('circle')).toHaveAttribute('fill', '#22c55e')
    rerender(<GateBarrier open={false} />)
    expect(container.querySelector('circle')).toHaveAttribute('fill', '#ef4444')
  })

  it('blinks the light only when highlighted', () => {
    const { container, rerender } = render(<GateBarrier open />)
    expect(container.querySelector('animate')).toBeNull()
    rerender(<GateBarrier open highlight />)
    expect(container.querySelector('animate')).not.toBeNull()
  })
})
