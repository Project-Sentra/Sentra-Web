import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FacilityCard from '../FacilityCard'

const facility = {
  id: 7,
  name: 'Colombo City Centre',
  city: 'Colombo',
  total_spots: 40,
  occupied_spots: 10,
  available_spots: 28,
  reserved_spots: 2,
  hourly_rate: 200,
  is_active: true,
}

const renderCard = (props = {}) =>
  render(
    <MemoryRouter>
      <FacilityCard facility={facility} {...props} />
    </MemoryRouter>
  )

describe('FacilityCard', () => {
  it('renders the facility name and city', () => {
    renderCard()
    expect(screen.getByText('Colombo City Centre')).toBeInTheDocument()
    expect(screen.getByText('Colombo')).toBeInTheDocument()
  })

  it('links to the facility dashboard', () => {
    renderCard()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/7')
  })

  it('shows occupancy percentage', () => {
    renderCard()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('shows available spots, reserved count and rate', () => {
    renderCard()
    expect(screen.getByText(/28 \/ 40/)).toBeInTheDocument()
    expect(screen.getByText('(2 reserved)')).toBeInTheDocument()
    expect(screen.getByText('LKR 200/hr')).toBeInTheDocument()
  })

  it('falls back to a padded ID when city is missing', () => {
    render(
      <MemoryRouter>
        <FacilityCard facility={{ ...facility, city: null }} />
      </MemoryRouter>
    )
    expect(screen.getByText('ID #007')).toBeInTheDocument()
  })

  it('shows Inactive badge for inactive facilities', () => {
    render(
      <MemoryRouter>
        <FacilityCard facility={{ ...facility, is_active: false }} />
      </MemoryRouter>
    )
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('reports 0% occupancy when there are no spots', () => {
    render(
      <MemoryRouter>
        <FacilityCard facility={{ id: 1, name: 'Empty' }} />
      </MemoryRouter>
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('hides action buttons when no handlers are given', () => {
    renderCard()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('calls onEdit and onDelete with the facility', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderCard({ onEdit, onDelete })

    await userEvent.click(screen.getByText('Edit'))
    await userEvent.click(screen.getByText('Delete'))

    expect(onEdit).toHaveBeenCalledWith(facility)
    expect(onDelete).toHaveBeenCalledWith(facility)
  })
})
