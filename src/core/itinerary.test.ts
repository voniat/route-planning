import { describe, expect, it } from 'vitest'
import { buildItineraryText } from './itinerary'
import { normalizePoints } from './points'

const points = normalizePoints([
  { title: '北京南站', lat: 39.865, lng: 116.378 },
  { title: '天安门', lat: 39.909, lng: 116.397 }
])

describe('buildItineraryText', () => {
  it('includes the city and numbered points', () => {
    expect(buildItineraryText(points, '北京')).toBe(
      '【旅行路线】北京 · 2个地点\n1. 北京南站\n2. 天安门'
    )
  })

  it('omits the city when empty', () => {
    expect(buildItineraryText(points, '')).toContain('【旅行路线】2个地点')
  })

  it('handles an empty route', () => {
    expect(buildItineraryText([], '北京')).toBe('【旅行路线】北京 · 0个地点')
  })
})
