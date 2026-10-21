export const MAX_POINTS = 20

export interface Point {
  id: string
  title: string
  lat: number
  lng: number
  address?: string
}

let pointSeq = 0

export function createPointId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  pointSeq += 1
  return `point-${Date.now()}-${pointSeq}`
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export function isDuplicateCoordinate(
  points: readonly Point[],
  lat: number,
  lng: number
): boolean {
  const latKey = lat.toFixed(4)
  const lngKey = lng.toFixed(4)
  return points.some((point) => point.lat.toFixed(4) === latKey && point.lng.toFixed(4) === lngKey)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizePoints(input: unknown, maxPoints: number = MAX_POINTS): Point[] {
  if (!Array.isArray(input)) return []
  const limit = Number.isInteger(maxPoints) && maxPoints > 0 ? maxPoints : MAX_POINTS
  const seenIds = new Set<string>()
  const points: Point[] = []

  for (const raw of input) {
    if (points.length >= limit) break
    if (!isRecord(raw)) continue
    const lat = raw.lat
    const lng = raw.lng
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidCoordinate(lat, lng)) continue

    let id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : createPointId()
    if (seenIds.has(id)) id = createPointId()
    seenIds.add(id)

    const title = typeof raw.title === 'string' ? raw.title.trim() : ''
    const address = typeof raw.address === 'string' ? raw.address : ''
    const safeTitle = (title || address || '未命名地点').slice(0, 100)

    points.push({
      id,
      title: safeTitle,
      lat,
      lng,
      address: address || undefined
    })
  }

  return points
}
