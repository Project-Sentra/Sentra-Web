import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const service = vi.hoisted(() => ({
  getFacility: vi.fn(),
  getGates: vi.fn(),
  getGateEvents: vi.fn(),
  openGate: vi.fn(),
  closeGate: vi.fn(),
  addGate: vi.fn(),
}))

vi.mock('../../services/lprService', () => ({ default: service }))

import Gates from '../admin/Gates'

const entryGate = { id: 4, name: 'Main Entry', gate_type: 'entry', status: 'closed' }

function renderGates() {
  return render(
    <MemoryRouter initialEntries={['/admin/1/gates']}>
      <Routes>
        <Route path="/admin/:facilityId/gates" element={<Gates />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Gates page (FR-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    service.getFacility.mockResolvedValue({ facility: { name: 'Sentra Main Parking' } })
    service.getGates.mockResolvedValue([entryGate])
    service.getGateEvents.mockResolvedValue([])
    service.openGate.mockResolvedValue({})
    service.closeGate.mockResolvedValue({})
  })

  it('opens a gate for a plate typed by the operator', async () => {
    renderGates()
    expect(await screen.findByText('Main Entry')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Plate number for Main Entry'), {
      target: { value: 'wp cab-1234' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    await waitFor(() => expect(service.openGate).toHaveBeenCalledWith(4, 'WP CAB-1234'))
  })

  it('only allows closing a gate that is open', async () => {
    service.getGates.mockResolvedValue([{ ...entryGate, status: 'open' }])
    renderGates()

    const close = await screen.findByRole('button', { name: 'Close' })
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
    fireEvent.click(close)

    await waitFor(() => expect(service.closeGate).toHaveBeenCalledWith(4))
  })

  it('highlights a gate the AI has just opened and lists the event', async () => {
    service.getGateEvents.mockResolvedValue([
      {
        id: 1,
        gate_id: 4,
        event_type: 'open',
        triggered_by: 'auto_lpr',
        plate_number: 'ABC-1234',
        created_at: new Date().toISOString(),
        gates: { name: 'Main Entry' },
      },
    ])
    renderGates()

    expect(await screen.findByText('OPENED BY AI')).toBeInTheDocument()
    expect(screen.getByText('AI · LPR')).toBeInTheDocument()
    expect(screen.getAllByText('ABC-1234').length).toBeGreaterThan(0)
  })

  it('shows the backend error message when an action fails', async () => {
    service.openGate.mockRejectedValue({ response: { data: { message: 'Gate not found' } } })
    renderGates()

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))

    expect(await screen.findByText('Gate not found')).toBeInTheDocument()
  })
})
