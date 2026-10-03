import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RequireAdmin from '../RequireAdmin'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path='/signin' element={<div>Sign in page</div>} />
        <Route element={<RequireAdmin />}>
          <Route path='/admin' element={<div>Admin area</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireAdmin', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redirects to sign in when not logged in', () => {
    renderAt('/admin')
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument()
  })

  it('redirects a logged-in non-admin user', () => {
    localStorage.setItem('accessToken', 'token')
    localStorage.setItem('userRole', 'user')
    renderAt('/admin')
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
  })

  it('allows admins', () => {
    localStorage.setItem('accessToken', 'token')
    localStorage.setItem('userRole', 'admin')
    renderAt('/admin')
    expect(screen.getByText('Admin area')).toBeInTheDocument()
  })

  it('allows operators', () => {
    localStorage.setItem('accessToken', 'token')
    localStorage.setItem('userRole', 'operator')
    renderAt('/admin')
    expect(screen.getByText('Admin area')).toBeInTheDocument()
  })

  it('does not trust a role without a token', () => {
    localStorage.setItem('userRole', 'admin')
    renderAt('/admin')
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
  })
})
