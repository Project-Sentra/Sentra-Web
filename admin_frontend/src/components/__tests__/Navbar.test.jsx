import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../Navbar'

// Mock the logo import
vi.mock('../../assets/logo_notext.png', () => ({ default: 'logo.png' }))

describe('Navbar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the Sentra brand name', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getByText('Sentra')).toBeInTheDocument()
  })

  it('shows Sign in and Sign up when not logged in', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sign up').length).toBeGreaterThan(0)
  })

  it('shows Logout when logged in', () => {
    localStorage.setItem('userEmail', 'test@test.com')
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getAllByText('Logout').length).toBeGreaterThan(0)
  })

  it('shows Facilities link', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getAllByText('Facilities').length).toBeGreaterThan(0)
  })
})
