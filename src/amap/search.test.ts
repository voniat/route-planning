import { describe, expect, it } from 'vitest'
import { mapPlaceSearchResult, mapTipsResult } from './search'

describe('mapPlaceSearchResult', () => {
  it('reads the JS API poiList shape', () => {
    const places = mapPlaceSearchResult({
      info: 'OK',
      poiList: {
        count: 1,
        pageIndex: 1,
        pageSize: 20,
        pois: [
          {
            id: 'B000A8UIN8',
            name: '天安门',
            address: '东城区东长安街',
            location: { lng: 116.397, lat: 39.909 }
          }
        ]
      }
    })
    expect(places).toHaveLength(1)
    expect(places[0]).toEqual({
      id: 'B000A8UIN8',
      title: '天安门',
      address: '东城区东长安街',
      lat: 39.909,
      lng: 116.397
    })
  })

  it('still accepts a top-level pois array and deduplicates coordinates', () => {
    const places = mapPlaceSearchResult({
      pois: [
        { name: 'A', address: '路 1', location: '116.397,39.909' },
        { name: 'A duplicate', address: '路 1', location: { lng: 116.397, lat: 39.909 } },
        { name: 'Bad', location: 'not-a-coordinate' }
      ]
    })
    expect(places).toHaveLength(1)
    expect(places[0]?.title).toBe('A')
  })

  it('returns an empty list for invalid input', () => {
    expect(mapPlaceSearchResult(null)).toEqual([])
    expect(mapPlaceSearchResult({ poiList: {} })).toEqual([])
  })
})

describe('mapTipsResult', () => {
  it('maps tips and skips entries without a name', () => {
    const tips = mapTipsResult({
      info: 'OK',
      count: 2,
      tips: [
        { id: '1', name: '天安门', district: '北京市东城区' },
        { id: '2', name: '' }
      ]
    })
    expect(tips).toEqual([{ id: '1', name: '天安门', district: '北京市东城区' }])
  })
})
