import { describe, expect, it } from 'vitest'
import { normalizePoints, MAX_POINTS } from '../core/points'
import { initialPlannerState, plannerReducer } from './planner'

const points = normalizePoints([
  { title: 'A', lat: 39.9, lng: 116.4 },
  { title: 'B', lat: 39.91, lng: 116.41 },
  { title: 'C', lat: 39.92, lng: 116.42 }
])

describe('plannerReducer insert-point', () => {
  it('restores a removed point at its original index', () => {
    const removed = points[1]
    const state = { ...initialPlannerState, points: [points[0], points[2]] }
    const next = plannerReducer(state, { type: 'insert-point', point: removed, index: 1 })
    expect(next.points.map((point) => point.title)).toEqual(['A', 'B', 'C'])
  })

  it('clamps the index and respects the point limit', () => {
    const one = { ...initialPlannerState, points: [points[0]] }
    expect(
      plannerReducer(one, { type: 'insert-point', point: points[1], index: 99 }).points.map(
        (point) => point.title
      )
    ).toEqual(['A', 'B'])

    const full = normalizePoints(
      Array.from({ length: MAX_POINTS }, (_, index) => ({
        title: `P${index}`,
        lat: 30 + index / 100,
        lng: 120 + index / 100
      }))
    )
    const fullState = { ...initialPlannerState, points: full }
    const unchanged = plannerReducer(fullState, {
      type: 'insert-point',
      point: points[0],
      index: 0
    })
    expect(unchanged.points).toHaveLength(MAX_POINTS)
    expect(unchanged.points[0]?.title).toBe('P0')
  })
})
