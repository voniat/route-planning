import { AppError } from '../core/errors'
import type { AmapNamespace, LngLat } from './types'

export interface PlaceResult {
  id: string
  title: string
  address: string
  lat: number
  lng: number
}

export interface Suggestion {
  id: string
  name: string
  district: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readAddress(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter((part): part is string => typeof part === 'string').join('')
  return ''
}

function readCoordinate(value: unknown): LngLat | null {
  if (typeof value === 'string') {
    const [lngRaw, latRaw] = value.split(',')
    const lng = Number(lngRaw)
    const lat = Number(latRaw)
    return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null
  }
  if (!isRecord(value)) return null
  const lng =
    typeof value.lng === 'number'
      ? value.lng
      : typeof value.getLng === 'function'
        ? Number((value.getLng as () => number)())
        : Number.NaN
  const lat =
    typeof value.lat === 'number'
      ? value.lat
      : typeof value.getLat === 'function'
        ? Number((value.getLat as () => number)())
        : Number.NaN
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null
}

export function mapPlaceSearchResult(result: unknown): PlaceResult[] {
  const record = isRecord(result) ? result : {}
  const poiList = isRecord(record.poiList) ? record.poiList : null
  const pois =
    poiList && Array.isArray(poiList.pois)
      ? poiList.pois
      : Array.isArray(record.pois)
        ? record.pois
        : []
  const seen = new Set<string>()
  const places: PlaceResult[] = []
  pois.forEach((poi, index) => {
    if (!isRecord(poi)) return
    const coordinate = readCoordinate(poi.location)
    if (!coordinate) return
    const key = `${coordinate.lat.toFixed(4)},${coordinate.lng.toFixed(4)}`
    if (seen.has(key)) return
    seen.add(key)
    places.push({
      id: readString(poi.id) || `poi-${index}`,
      title: readString(poi.name) || '未命名地点',
      address: readAddress(poi.address),
      lat: coordinate.lat,
      lng: coordinate.lng
    })
  })
  return places
}

export function mapTipsResult(result: unknown): Suggestion[] {
  const record = isRecord(result) ? result : {}
  const tips = Array.isArray(record.tips) ? record.tips : []
  const suggestions: Suggestion[] = []
  for (const tip of tips) {
    if (!isRecord(tip) || !readString(tip.name)) continue
    suggestions.push({
      id: readString(tip.id),
      name: readString(tip.name),
      district: readString(tip.district)
    })
    if (suggestions.length >= 10) break
  }
  return suggestions
}

export function searchPlaces(
  amap: AmapNamespace,
  keyword: string,
  city: string
): Promise<PlaceResult[]> {
  return new Promise((resolve, reject) => {
    const service = new amap.PlaceSearch({ city, pageSize: 20, extensions: 'base' })
    service.search(keyword, (status, result) => {
      if (status !== 'complete') {
        const info = isRecord(result) && typeof result.info === 'string' ? result.info : '搜索失败'
        reject(new AppError('SEARCH', info))
        return
      }
      resolve(mapPlaceSearchResult(result))
    })
  })
}

export function loadSuggestions(
  amap: AmapNamespace,
  keyword: string,
  city: string
): Promise<Suggestion[]> {
  return new Promise((resolve) => {
    const service = new amap.AutoComplete({ city })
    service.search(keyword, (status, result) => {
      if (status !== 'complete') {
        resolve([])
        return
      }
      resolve(mapTipsResult(result))
    })
  })
}
