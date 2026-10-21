import { describe, expect, it } from 'vitest'
import { createFavoriteStore, MAX_FAVORITES } from './favorites'
import { createMemoryStorage, STORAGE_KEYS, type StorageLike } from './storage'
import { normalizePoints, type Point } from './points'

function makePoints(label: string): Point[] {
  return normalizePoints([{ title: label, lat: 39.9, lng: 116.4 }], 20)
}

describe('favorite store', () => {
  it('adds, lists and reads a route', () => {
    const storage = createMemoryStorage()
    const store = createFavoriteStore(storage)
    const points = makePoints('天安门')
    const added = store.add(points, '北京', '周末路线')
    expect(added?.droppedOldest).toBe(false)
    expect(added?.route.name).toBe('周末路线')
    expect(store.list()).toHaveLength(1)
    expect(store.getById(added?.route.id ?? -1)?.points[0]?.title).toBe('天安门')
  })

  it('uses a default name when the custom name is empty', () => {
    const store = createFavoriteStore(createMemoryStorage())
    const added = store.add(makePoints('故宫'), '北京', '   ')
    expect(added?.route.name).toBe('故宫 等1站')
  })

  it('drops the oldest route beyond the limit', () => {
    const store = createFavoriteStore(createMemoryStorage())
    for (let index = 0; index < MAX_FAVORITES; index += 1) {
      store.add(makePoints(`路线${index}`), '北京')
    }
    const oldestId = store.list()[0]?.id
    const added = store.add(makePoints('新路线'), '北京')
    expect(added?.droppedOldest).toBe(true)
    expect(store.list()).toHaveLength(MAX_FAVORITES)
    expect(store.list()[0]?.id).not.toBe(oldestId)
  })

  it('filters corrupted entries while reading', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STORAGE_KEYS.favorites,
      JSON.stringify([
        { id: 1, name: '坏数据' },
        {
          id: 2,
          name: '好数据',
          city: '北京',
          points: [{ title: 'A', lat: 39.9, lng: 116.4 }],
          savedAt: '2026/10/21'
        }
      ])
    )
    const routes = createFavoriteStore(storage).list()
    expect(routes).toHaveLength(1)
    expect(routes[0]?.id).toBe(2)
    expect(routes[0]?.points[0]?.id).toBeTruthy()
  })

  it('removes by id and reports missing ids', () => {
    const store = createFavoriteStore(createMemoryStorage())
    const added = store.add(makePoints('A'), '北京')
    expect(store.remove(added?.route.id ?? -1)).toBe(true)
    expect(store.list()).toHaveLength(0)
    expect(store.remove('missing')).toBe(false)
  })

  it('returns null when storage writes fail', () => {
    const broken: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {}
    }
    const store = createFavoriteStore(broken)
    expect(store.add(makePoints('A'), '北京')).toBeNull()
  })
})
