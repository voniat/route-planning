export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEYS = {
  draft: 'rp:v1:draft',
  favorites: 'rp:v1:favorites',
  searchHistory: 'rp:v1:search-history'
} as const

export function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>()
  return {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    }
  }
}

export function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const key = '__rp_storage_probe__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return window.localStorage
  } catch {
    return null
  }
}

export function readJson<T>(storage: StorageLike | null, key: string): T | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
