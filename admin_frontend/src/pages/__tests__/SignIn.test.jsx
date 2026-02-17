import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock the logo import
vi.mock('../../assets/logo_notext.png', () => ({ default: 'logo.png' }))

// We need to import after mocks
import SignIn from '../SignIn'

describe('SignIn Page', () => {
  it('renders the sign in form', () => {
    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    )
    // Should have email and password inputs
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
  })

  it('has a sign in button', () => {
    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    )
    const buttons = screen.getAllByRole('button')
    const signInBtn = buttons.find(b => b.textContent.toLowerCase().includes('sign in'))
    expect(signInBtn).toBeDefined()
  })
})
