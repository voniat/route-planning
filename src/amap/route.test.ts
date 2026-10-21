import { describe, expect, it } from 'vitest'
import { mapTransferPlans, mapWalkingResult } from './route'

const transferFixture = [
  {
    distance: 7256,
    time: 2461,
    cost: 3,
    segments: [
      {
        transit_mode: 'WALK',
        instruction: '步行253米到达西单',
        distance: 253,
        time: 200,
        transit: {
          path: [
            { lng: 116.378, lat: 39.865 },
            { lng: 116.38, lat: 39.866 }
          ],
          steps: [
            {
              instruction: '步行45米右转',
              distance: 45,
              time: 36,
              path: [
                { lng: 116.378, lat: 39.865 },
                { lng: 116.379, lat: 39.866 }
              ]
            }
          ]
        }
      },
      {
        transit_mode: 'SUBWAY',
        instruction: '乘坐地铁1号线(苹果园--环球度假区)途径0站到达天安门西',
        distance: 1300,
        time: 300,
        transit: {
          path: [
            { lng: 116.38, lat: 39.866 },
            { lng: 116.39, lat: 39.907 }
          ],
          on_station: { name: '西单' },
          off_station: { name: '天安门西' },
          via_num: 0,
          lines: [{ name: '地铁1号线', type: '地铁线路' }]
        }
      }
    ]
  }
]

const walkingFixture = {
  routes: [
    {
      distance: 2172,
      time: 1738,
      steps: [
        {
          instruction: '向北步行45米右转',
          distance: 45,
          time: 36,
          path: [
            { lng: 116.397, lat: 39.909 },
            { lng: 116.3975, lat: 39.9095 }
          ]
        },
        {
          instruction: '继续步行',
          distance: 100,
          time: 70,
          path: [
            { lng: 116.3975, lat: 39.9095 },
            { lng: 116.398, lat: 39.91 }
          ]
        }
      ]
    }
  ]
}

describe('mapTransferPlans', () => {
  it('maps plans, steps and colored polylines from the JS API shape', () => {
    const plans = mapTransferPlans(transferFixture)
    expect(plans).toHaveLength(1)
    const plan = plans[0]
    expect(plan?.cost).toBe(3)
    expect(plan?.durationMin).toBe(41)
    expect(plan?.distanceKm).toBe('7.3')
    expect(plan?.steps).toHaveLength(2)
    expect(plan?.steps[0]?.mode).toBe('WALKING')
    expect(plan?.steps[1]?.mode).toBe('TRANSIT')
    expect(plan?.steps[1]?.transitType).toBe('🚇 地铁')
    expect(plan?.steps[1]?.fromStation).toBe('西单')
    expect(plan?.steps[1]?.toStation).toBe('天安门西')
    expect(plan?.steps[1]?.lineName).toBe('地铁1号线')
    expect(plan?.polylines).toHaveLength(2)
    expect(plan?.polylines[1]?.color).not.toBe(plan?.polylines[0]?.color)
  })

  it('returns an empty list for invalid input', () => {
    expect(mapTransferPlans(null)).toEqual([])
    expect(mapTransferPlans([{ segments: [] }])).toEqual([])
  })
})

describe('mapWalkingResult', () => {
  it('maps distance, duration and the step path', () => {
    const walking = mapWalkingResult(walkingFixture, { lng: 116.397, lat: 39.909 }, { lng: 116.41, lat: 39.92 })
    expect(walking.durationMin).toBe(29)
    expect(walking.distanceKm).toBe('2.2')
    expect(walking.polyline.path).toHaveLength(4)
  })

  it('throws when no route exists', () => {
    expect(() => mapWalkingResult({ routes: [] }, { lng: 0, lat: 0 }, { lng: 1, lat: 1 })).toThrow(
      /未找到步行路线/
    )
  })
})
