import { describe, expect, it } from 'vitest'
import { createMemoryStorage, getBrowserStorage, readJson, writeJson, type StorageLike } from './storage'

describe('storage helpers', () => {
  it('round-trips JSON through a memory storage', () => {
    const storage = createMemoryStorage()
    expect(writeJson(storage, 'key', { ok: true })).toBe(true)
    expect(readJson<{ ok: boolean }>(storage, 'key')).toEqual({ ok: true })
    expect(readJson(storage, 'missing')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const storage = createMemoryStorage()
    storage.setItem('broken', '{not-json')
    expect(readJson(storage, 'broken')).toBeNull()
  })

  it('reports failed writes instead of throwing', () => {
    const broken: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {}
    }
    expect(writeJson(broken, 'key', { ok: true })).toBe(false)
  })

  it('has no browser storage in a node test environment', () => {
    expect(getBrowserStorage()).toBeNull()
  })
})
