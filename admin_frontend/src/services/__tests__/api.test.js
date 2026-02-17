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
})
