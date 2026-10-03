import '@testing-library/jest-dom'

// Node 25+ defines its own global `localStorage`, which shadows jsdom's and is
// undefined unless Node is started with --localstorage-file. Provide a simple
// in-memory Storage so tests behave the same on every Node version.
function createMemoryStorage() {
  let store = {}
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

let storageWorks = false
try {
  storageWorks = typeof globalThis.localStorage?.clear === 'function'
} catch {
  storageWorks = false
}

if (!storageWorks) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  })
}
