import { describe, expect, it } from 'vitest'
import { decodeShare, encodeShare } from './share'
import { normalizePoints } from './points'

function makePoints(): ReturnType<typeof normalizePoints> {
  return normalizePoints([
    { title: '北京天安门广场东侧', lat: 39.908, lng: 116.397 },
    { title: '故宫博物院', lat: 39.916, lng: 116.397 }
  ])
}

describe('share codec', () => {
  it('round-trips points and city', () => {
    const search = encodeShare(makePoints(), '北京')
    expect(search).toBeTruthy()
    const decoded = decodeShare(search ?? '')
    expect(decoded?.city).toBe('北京')
    expect(decoded?.points).toHaveLength(2)
    expect(decoded?.points[0]?.title).toBe('北京天安门广场东')
    expect(decoded?.points[1]?.title).toBe('故宫博物院')
  })

  it('accepts a search string with a leading question mark', () => {
    const search = encodeShare(makePoints(), '北京')
    expect(decodeShare(`?${search ?? ''}`)?.points).toHaveLength(2)
  })

  it('rejects empty and over-limit point lists', () => {
    expect(encodeShare([], '北京')).toBeNull()
    const many = normalizePoints(
      Array.from({ length: 21 }, (_, index) => ({
        title: `P${index}`,
        lat: 30 + index / 100,
        lng: 120 + index / 100
      })),
      25
    )
    expect(encodeShare(many, '北京')).toBeNull()
  })

  it('keeps a twenty-point link below the length limit', () => {
    const points = normalizePoints(
      Array.from({ length: 20 }, (_, index) => ({
        title: `P${index}`,
        lat: 30 + index / 100,
        lng: 120 + index / 100
      }))
    )
    const search = encodeShare(points, '北京')
    expect(search).not.toBeNull()
    expect((search ?? '').length).toBeLessThan(2200)
  })

  it('rejects malformed, invalid-coordinate and unknown-city payloads', () => {
    expect(decodeShare('')).toBeNull()
    expect(decodeShare('p=%7B')).toBeNull()
    expect(decodeShare(`p=${encodeURIComponent('[["A",1]]')}`)).toBeNull()
    expect(decodeShare(`p=${encodeURIComponent('[["A",100,0]]')}`)).toBeNull()
    const badCity = encodeShare(makePoints(), '火星')
    expect(decodeShare(badCity ?? '')).toBeNull()
  })
})
