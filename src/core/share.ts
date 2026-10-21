import { findCity } from './cities'
import { MAX_POINTS, isValidCoordinate, normalizePoints, type Point } from './points'

export const MAX_SHARE_LENGTH = 2200
const MAX_SHARE_TITLE = 8

export interface SharePayload {
  points: Point[]
  city: string
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

export function encodeShare(points: readonly Point[], city: string): string | null {
  if (points.length === 0 || points.length > MAX_POINTS) return null
  const rows: [string, number, number][] = []
  for (const point of points) {
    if (!isValidCoordinate(point.lat, point.lng)) return null
    rows.push([point.title.slice(0, MAX_SHARE_TITLE), roundCoordinate(point.lat), roundCoordinate(point.lng)])
  }

  const params = new URLSearchParams()
  params.set('p', JSON.stringify(rows))
  params.set('c', city)
  const search = params.toString()
  return search.length < MAX_SHARE_LENGTH ? search : null
}

export function decodeShare(search: string): SharePayload | null {
  const normalized = search.startsWith('?') ? search.slice(1) : search
  if (!normalized) return null

  const params = new URLSearchParams(normalized)
  const raw = params.get('p')
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_POINTS) return null

  const points = normalizePoints(
    parsed.map((row) => {
      if (!Array.isArray(row) || row.length !== 3) return null
      return { title: row[0], lat: row[1], lng: row[2] }
    }),
    MAX_POINTS
  )
  if (points.length !== parsed.length) return null

  const cityRaw = params.get('c') ?? ''
  let city = ''
  if (cityRaw) {
    const matched = findCity(cityRaw)
    if (!matched) return null
    city = matched.name
  }

  return { points, city }
}
