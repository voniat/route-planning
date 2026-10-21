import { describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './draft'
import { normalizePoints } from './points'
import { createMemoryStorage, STORAGE_KEYS } from './storage'

const points = normalizePoints([
  { title: '天安门', lat: 39.908, lng: 116.397 },
  { title: '故宫', lat: 39.916, lng: 116.397 }
])

describe('draft', () => {
  it('round-trips points and city', () => {
    const storage = createMemoryStorage()
    expect(saveDraft(storage, points, '北京')).toBe(true)
    const draft = loadDraft(storage)
    expect(draft?.city).toBe('北京')
    expect(draft?.points).toHaveLength(2)
    expect(draft?.points[0]?.title).toBe('天安门')
  })

  it('rejects empty points and malformed storage', () => {
    const storage = createMemoryStorage()
    expect(saveDraft(storage, [], '北京')).toBe(false)
    storage.setItem(STORAGE_KEYS.draft, '{not-json')
    expect(loadDraft(storage)).toBeNull()
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify({ points: [{ title: '坏点', lat: 100, lng: 0 }] }))
    expect(loadDraft(storage)).toBeNull()
  })

  it('clears the draft', () => {
    const storage = createMemoryStorage()
    saveDraft(storage, points, '北京')
    clearDraft(storage)
    expect(loadDraft(storage)).toBeNull()
  })
})
