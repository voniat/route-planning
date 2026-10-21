import { MAX_POINTS, normalizePoints, type Point } from './points'
import { STORAGE_KEYS, readJson, writeJson, type StorageLike } from './storage'

export interface Draft {
  points: Point[]
  city: string
  savedAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function loadDraft(storage: StorageLike | null): Draft | null {
  const raw = readJson<unknown>(storage, STORAGE_KEYS.draft)
  if (!isRecord(raw)) return null
  const points = normalizePoints(raw.points, MAX_POINTS)
  if (points.length === 0) return null
  return {
    points,
    city: typeof raw.city === 'string' ? raw.city : '',
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0
  }
}

export function saveDraft(storage: StorageLike | null, points: readonly Point[], city: string): boolean {
  const normalized = normalizePoints(points, MAX_POINTS)
  if (normalized.length === 0) return false
  return writeJson(storage, STORAGE_KEYS.draft, {
    points: normalized,
    city,
    savedAt: Date.now()
  })
}

export function clearDraft(storage: StorageLike | null): void {
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEYS.draft)
  } catch {
    // 存储不可用时保持静默，页面仍可继续操作。
  }
}
