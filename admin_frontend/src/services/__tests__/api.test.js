import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock import.meta.env before importing
vi.stubGlobal('localStorage', {
  store: {},
  getItem(key) { return this.store[key] || null },
  setItem(key, val) { this.store[key] = val },
  removeItem(key) { delete this.store[key] },
  clear() { this.store = {} },
})

describe('api service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should be importable', async () => {
    const { default: api } = await import('../../services/api.js')
    expect(api).toBeDefined()
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('should have a timeout configured', async () => {
    const { default: api } = await import('../../services/api.js')
    expect(api.defaults.timeout).toBe(10000)
  })

  it('attaches the stored token to backend and LPR requests', async () => {
    const { api, lprApi } = await import('../../services/api.js')
    localStorage.setItem('accessToken', 'abc123')
    for (const client of [api, lprApi]) {
      const handler = client.interceptors.request.handlers[0].fulfilled
      const config = await handler({ headers: {} })
      expect(config.headers.Authorization).toBe('Bearer abc123')
    }
  })

  it('isAdminSession requires both a token and an admin/operator role', async () => {
    const { isAdminSession } = await import('../../services/api.js')
    expect(isAdminSession()).toBe(false)
    localStorage.setItem('userRole', 'admin')
    expect(isAdminSession()).toBe(false)
    localStorage.setItem('accessToken', 'abc123')
    expect(isAdminSession()).toBe(true)
    localStorage.setItem('userRole', 'user')
    expect(isAdminSession()).toBe(false)
  })

  it('clearSession removes auth data', async () => {
    const { clearSession } = await import('../../services/api.js')
    localStorage.setItem('accessToken', 'abc123')
    localStorage.setItem('userRole', 'admin')
    clearSession()
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('userRole')).toBeNull()
  })
})
