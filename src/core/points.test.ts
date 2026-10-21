import { describe, expect, it } from 'vitest'
import {
  MAX_POINTS,
  createPointId,
  isDuplicateCoordinate,
  normalizePoints,
  type Point
} from './points'

function point(overrides: Partial<Point> = {}): Point {
  return {
    id: 'p1',
    title: '天安门',
    lat: 39.908,
    lng: 116.397,
    ...overrides
  }
}

describe('normalizePoints', () => {
  it('filters invalid coordinates and non-object entries', () => {
    const points = normalizePoints([
      { title: 'A', lat: 39.9, lng: 116.4 },
      { title: 'B', lat: 100, lng: 0 },
      { title: 'C', lat: '39.9', lng: 116.4 },
      null
    ])
    expect(points).toHaveLength(1)
    expect(points[0]?.title).toBe('A')
  })

  it('caps the number of points', () => {
    const input = Array.from({ length: 25 }, (_, index) => ({
      title: `P${index}`,
      lat: 30 + index / 100,
      lng: 120 + index / 100
    }))
    expect(normalizePoints(input)).toHaveLength(MAX_POINTS)
    expect(normalizePoints(input, 3)).toHaveLength(3)
  })

  it('generates missing and duplicate ids', () => {
    const points = normalizePoints([
      { id: 'same', title: 'A', lat: 39.9, lng: 116.4 },
      { id: 'same', title: 'B', lat: 39.91, lng: 116.41 },
      { title: 'C', lat: 39.92, lng: 116.42 }
    ])
    expect(new Set(points.map((item) => item.id)).size).toBe(3)
  })

  it('falls back to address then unnamed title and truncates to 100 chars', () => {
    const points = normalizePoints([
      { lat: 39.9, lng: 116.4, address: '北京' },
      { lat: 39.91, lng: 116.41 },
      { lat: 39.92, lng: 116.42, title: 'x'.repeat(120) }
    ])
    expect(points[0]?.title).toBe('北京')
    expect(points[1]?.title).toBe('未命名地点')
    expect(points[2]?.title).toHaveLength(100)
  })
})

describe('isDuplicateCoordinate', () => {
  it('matches coordinates within four decimals', () => {
    const points = [point()]
    expect(isDuplicateCoordinate(points, 39.90801, 116.39701)).toBe(true)
    expect(isDuplicateCoordinate(points, 39.92, 116.42)).toBe(false)
  })
})

describe('createPointId', () => {
  it('returns unique ids', () => {
    expect(createPointId()).not.toBe(createPointId())
  })
})
