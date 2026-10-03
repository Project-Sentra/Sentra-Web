import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../assets/logo_notext.png', () => ({ default: 'logo.png' }))

const { getSession, signOut, post } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
  post: vi.fn(),
}))

vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: { getSession, signOut, onAuthStateChange: vi.fn() },
  },
}))

vi.mock('../../services/api', () => ({
  default: { post },
  clearSession: () => localStorage.clear(),
}))

import AuthCallback from '../AuthCallback'

const session = { access_token: 'access', refresh_token: 'refresh' }

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/admin" element={<p>Admin home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthCallback (Google sign-in)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('shows the provider error instead of waiting for a timeout', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/callback?error=access_denied&error_description=User+cancelled',
    )
    renderCallback()
    expect(await screen.findByText('User cancelled')).toBeInTheDocument()
    expect(getSession).not.toHaveBeenCalled()
  })

  it('refuses accounts without the admin or operator role', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    post.mockResolvedValue({ data: { user: { id: 'a', role: 'user' } } })

    renderCallback()

    expect(await screen.findByText(/does not have dashboard access/i)).toBeInTheDocument()
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(signOut).toHaveBeenCalled()
  })

  it('signs admins in and opens the dashboard', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    post.mockResolvedValue({
      data: { user: { id: 'a', db_id: 3, email: 'admin@gmail.com', role: 'admin' } },
    })

    renderCallback()

    expect(await screen.findByText('Admin home')).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/auth/social-login')
    await waitFor(() => expect(localStorage.getItem('userRole')).toBe('admin'))
    expect(localStorage.getItem('accessToken')).toBe('access')
  })
})
