import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const service = vi.hoisted(() => ({
  getFacility: vi.fn(),
  getReportSummary: vi.fn(),
  downloadSessionsCsv: vi.fn(),
}))

vi.mock('../../services/lprService', () => ({ default: service }))

// Recharts needs real layout sizes; render plain containers in jsdom
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => <div style={{ width: 600, height: 300 }}>{children}</div>,
  }
})

import Reports from '../admin/Reports'

const report = {
  days: 30,
  timezone: 'Asia/Colombo',
  totals: {
    entries: 12,
    exits: 10,
    active: 2,
    revenue: 4500,
    collected: 3000,
    pending: 1500,
    unique_vehicles: 9,
    avg_duration_minutes: 95,
  },
  daily: [{ date: '2026-10-03', entries: 12, revenue: 4500, collected: 3000 }],
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, entries: hour === 9 ? 5 : 0 })),
  heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)),
  peak_hour: 9,
  peak_weekday: 0,
  by_session_type: { walk_in: 10, reserved: 2 },
  by_entry_method: { lpr: 12 },
}

function renderReports() {
  return render(
    <MemoryRouter initialEntries={['/admin/1/reports']}>
      <Routes>
        <Route path="/admin/:facilityId/reports" element={<Reports />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Reports page (FR-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    service.getFacility.mockResolvedValue({ facility: { name: 'Sentra Main Parking' } })
    service.getReportSummary.mockResolvedValue(report)
    service.downloadSessionsCsv.mockResolvedValue()
  })

  it('shows revenue, pending amount and the peak hour', async () => {
    renderReports()

    expect(await screen.findByText('LKR 4,500')).toBeInTheDocument()
    expect(screen.getByText('LKR 1,500 pending')).toBeInTheDocument()
    expect(screen.getByText('09:00–10:00')).toBeInTheDocument()
    expect(screen.getByText(/busiest Mon/)).toBeInTheDocument()
    expect(service.getReportSummary).toHaveBeenCalledWith(1, 30)
  })

  it('reloads when the date range changes', async () => {
    renderReports()
    await screen.findByText('LKR 4,500')

    fireEvent.click(screen.getByRole('button', { name: '7 days' }))

    await waitFor(() => expect(service.getReportSummary).toHaveBeenCalledWith(1, 7))
  })

  it('exports the selected range as CSV', async () => {
    renderReports()
    await screen.findByText('LKR 4,500')

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() => expect(service.downloadSessionsCsv).toHaveBeenCalledWith(1, 30))
  })

  it('shows an error when the report cannot load', async () => {
    service.getReportSummary.mockRejectedValue({ response: { data: { message: 'facility_id is required' } } })
    renderReports()

    expect(await screen.findByText('facility_id is required')).toBeInTheDocument()
  })
})
