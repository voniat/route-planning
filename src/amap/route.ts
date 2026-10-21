import { AppError } from '../core/errors'
import type { AmapNamespace, LngLat } from './types'

export interface StepView {
  key: string
  mode: 'WALKING' | 'TRANSIT'
  title: string
  distanceM?: number
  durationMin?: number
  lineName?: string
  lineColor?: string
  transitType?: string
  fromStation?: string
  toStation?: string
  stations?: number
}

export interface PolylineView {
  path: [number, number][]
  color: string
  width: number
  dotted?: boolean
}

export interface PlanView {
  id: string
  cost: number | null
  durationMin: number
  distanceKm: string
  steps: StepView[]
  polylines: PolylineView[]
}

export interface WalkingView {
  durationMin: number
  distanceKm: string
  polyline: PolylineView
}

const WALK_COLOR = '#b4451f'
const LINE_COLORS = ['#3f6b57', '#4f5d75', '#c98a2e', '#8e5a3c', '#6b7f4a', '#536dfe', '#00bcd4', '#9c27b0']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function readCost(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

function readCoordinates(value: unknown): [number, number] | null {
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
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
}

function readPath(value: unknown): [number, number][] {
  const path: [number, number][] = []
  for (const item of readArray(value)) {
    const coordinate = readCoordinates(item)
    if (coordinate) path.push(coordinate)
  }
  return path
}

function buildColorMap(segments: unknown[]): Map<string, string> {
  const colors = new Map<string, string>()
  for (const rawSegment of segments) {
    if (!isRecord(rawSegment)) continue
    const transit = isRecord(rawSegment.transit) ? rawSegment.transit : {}
    const line = readArray(transit.lines)[0]
    if (!isRecord(line)) continue
    const name = readString(line.name)
    if (!name || colors.has(name)) continue
    colors.set(name, LINE_COLORS[colors.size % LINE_COLORS.length] ?? WALK_COLOR)
  }
  return colors
}

function transitTypeLabel(mode: string, lineType: string): string {
  if (mode === 'SUBWAY' || lineType.includes('地铁')) return '🚇 地铁'
  if (mode === 'RAILWAY' || lineType.includes('火车') || lineType.includes('高铁')) return '🚄 火车/高铁'
  return '🚌 公交'
}

function mapPlan(raw: unknown, index: number): PlanView | null {
  if (!isRecord(raw)) return null
  const segments = readArray(raw.segments)
  const colors = buildColorMap(segments)
  const steps: StepView[] = []
  const polylines: PolylineView[] = []

  segments.forEach((rawSegment, segmentIndex) => {
    if (!isRecord(rawSegment)) return
    const mode = readString(rawSegment.transit_mode).toUpperCase()
    const transit = isRecord(rawSegment.transit) ? rawSegment.transit : {}
    const path = readPath(transit.path)
    const line = readArray(transit.lines)[0]
    const lineName = isRecord(line) ? readString(line.name) : ''
    const lineType = isRecord(line) ? readString(line.type) : ''
    const durationMin = Math.round(toNumber(rawSegment.time) / 60)
    const distanceM = toNumber(rawSegment.distance)

    if (mode === 'WALK' || mode === 'WALKING') {
      steps.push({
        key: `walk-${segmentIndex}`,
        mode: 'WALKING',
        title: readString(rawSegment.instruction) || '步行',
        distanceM,
        durationMin
      })
      if (path.length > 1) polylines.push({ path, color: WALK_COLOR, width: 4, dotted: true })
      return
    }

    const lineColor = (lineName && colors.get(lineName)) || WALK_COLOR
    const onStation = isRecord(transit.on_station) ? readString(transit.on_station.name) : ''
    const offStation = isRecord(transit.off_station) ? readString(transit.off_station.name) : ''
    const viaNum = toNumber(transit.via_num)
    steps.push({
      key: `transit-${segmentIndex}`,
      mode: 'TRANSIT',
      title:
        readString(rawSegment.instruction) || (lineName ? `乘坐 ${lineName}` : '乘坐公共交通'),
      distanceM,
      durationMin,
      lineName: lineName || undefined,
      lineColor,
      transitType: transitTypeLabel(mode, lineType),
      fromStation: onStation || undefined,
      toStation: offStation || undefined,
      stations: viaNum > 0 ? viaNum : undefined
    })
    if (path.length > 1) polylines.push({ path, color: lineColor, width: 6 })
  })

  if (steps.length === 0) return null
  return {
    id: `plan-${index}`,
    cost: readCost(raw.cost),
    durationMin: Math.round(toNumber(raw.time) / 60),
    distanceKm: (toNumber(raw.distance) / 1000).toFixed(1),
    steps,
    polylines
  }
}

export function mapTransferPlans(plans: unknown): PlanView[] {
  const mapped: PlanView[] = []
  readArray(plans).forEach((raw, index) => {
    const plan = mapPlan(raw, index)
    if (plan) mapped.push(plan)
  })
  return mapped
}

export function mapWalkingResult(result: unknown, origin: LngLat, destination: LngLat): WalkingView {
  const routes = isRecord(result) ? readArray(result.routes) : []
  const route = routes[0]
  if (!isRecord(route)) throw new AppError('ROUTE', '未找到步行路线')

  let path: [number, number][] = []
  for (const rawStep of readArray(route.steps)) {
    if (!isRecord(rawStep)) continue
    path = path.concat(readPath(rawStep.path))
  }
  if (path.length < 2) {
    path = [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ]
  }

  return {
    durationMin: Math.round(toNumber(route.time) / 60),
    distanceKm: (toNumber(route.distance) / 1000).toFixed(1),
    polyline: { path, color: WALK_COLOR, width: 5 }
  }
}

function readInfo(result: unknown): string {
  return isRecord(result) && typeof result.info === 'string' ? result.info : ''
}

export function getTransitPlans(
  amap: AmapNamespace,
  origin: LngLat,
  destination: LngLat,
  city: string
): Promise<PlanView[]> {
  return new Promise((resolve, reject) => {
    const service = new amap.Transfer({ city })
    service.search([origin.lng, origin.lat], [destination.lng, destination.lat], (status, result) => {
      if (status !== 'complete') {
        reject(new AppError('ROUTE', readInfo(result) || '公交路线获取失败'))
        return
      }
      const plans = mapTransferPlans(isRecord(result) ? result.plans : [])
      if (plans.length === 0) {
        reject(new AppError('ROUTE', '未找到公交路线'))
        return
      }
      resolve(plans)
    })
  })
}

export function getWalkingPlan(
  amap: AmapNamespace,
  origin: LngLat,
  destination: LngLat
): Promise<WalkingView> {
  return new Promise((resolve, reject) => {
    const service = new amap.Walking()
    service.search([origin.lng, origin.lat], [destination.lng, destination.lat], (status, result) => {
      if (status !== 'complete') {
        reject(new AppError('ROUTE', readInfo(result) || '步行路线获取失败'))
        return
      }
      try {
        resolve(mapWalkingResult(result, origin, destination))
      } catch (error) {
        reject(error)
      }
    })
  })
}
