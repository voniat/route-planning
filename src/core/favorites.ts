import { MAX_POINTS, normalizePoints, type Point } from './points'
import { STORAGE_KEYS, readJson, writeJson, type StorageLike } from './storage'

export const MAX_FAVORITES = 50

export interface SavedRoute {
  id: number
  name: string
  city: string
  points: Point[]
  savedAt: string
}

export interface AddFavoriteResult {
  route: SavedRoute
  droppedOldest: boolean
}

export interface FavoriteStore {
  list(): SavedRoute[]
  add(points: readonly Point[], city: string, name?: string): AddFavoriteResult | null
  remove(id: number | string): boolean
  getById(id: number | string): SavedRoute | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeSavedRoute(value: unknown): SavedRoute | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'number' || !Number.isFinite(value.id)) return null
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const points = normalizePoints(value.points, MAX_POINTS)
  if (!name || points.length === 0) return null
  return {
    id: value.id,
    name,
    city: typeof value.city === 'string' ? value.city : '',
    points,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : ''
  }
}

function defaultName(points: readonly Point[]): string {
  const first = points[0]?.title ?? '未命名地点'
  return `${first} 等${points.length}站`
}

export function createFavoriteStore(storage: StorageLike): FavoriteStore {
  function list(): SavedRoute[] {
    const raw = readJson<unknown>(storage, STORAGE_KEYS.favorites)
    if (!Array.isArray(raw)) return []
    const routes: SavedRoute[] = []
    for (const item of raw) {
      const route = normalizeSavedRoute(item)
      if (route) routes.push(route)
    }
    return routes.slice(-MAX_FAVORITES)
  }

  function add(points: readonly Point[], city: string, name?: string): AddFavoriteResult | null {
    const normalized = normalizePoints(points, MAX_POINTS)
    if (normalized.length === 0) return null

    const routes = list()
    let droppedOldest = false
    if (routes.length >= MAX_FAVORITES) {
      routes.shift()
      droppedOldest = true
    }

    let id = Date.now()
    while (routes.some((route) => route.id === id)) id += 1

    const route: SavedRoute = {
      id,
      name: (name ?? '').trim() || defaultName(normalized),
      city: city.trim(),
      points: normalized,
      savedAt: new Date().toLocaleString('zh-CN', { hour12: false })
    }
    routes.push(route)
    if (!writeJson(storage, STORAGE_KEYS.favorites, routes)) return null
    return { route, droppedOldest }
  }

  function remove(id: number | string): boolean {
    const routes = list()
    const remaining = routes.filter((route) => String(route.id) !== String(id))
    if (remaining.length === routes.length) return false
    return writeJson(storage, STORAGE_KEYS.favorites, remaining)
  }

  function getById(id: number | string): SavedRoute | null {
    return list().find((route) => String(route.id) === String(id)) ?? null
  }

  return { list, add, remove, getById }
}
