import { describe, expect, it } from 'vitest'
import { CITY_COORDS, DEFAULT_CITY, PROVINCE_DATA, findCity } from './cities'

describe('city data', () => {
  it('contains a complete coordinate entry for every listed city', () => {
    const missing: string[] = []
    for (const province of PROVINCE_DATA) {
      expect(province.cities.length).toBeGreaterThan(0)
      for (const city of province.cities) {
        if (!CITY_COORDS[city]) missing.push(`${province.prov}/${city}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('does not include the national pseudo city', () => {
    expect(PROVINCE_DATA.some((province) => province.prov === '全国')).toBe(false)
    expect(PROVINCE_DATA.some((province) => province.cities.includes('全国'))).toBe(false)
    expect(CITY_COORDS['全国']).toBeUndefined()
  })

  it('defaults to Beijing', () => {
    expect(DEFAULT_CITY.name).toBe('北京')
    expect(DEFAULT_CITY.lat).toBeCloseTo(39.9042)
    expect(DEFAULT_CITY.lng).toBeCloseTo(116.4074)
  })
})

describe('findCity', () => {
  it('resolves city names with a suffix', () => {
    expect(findCity('北京市')?.name).toBe('北京')
    expect(findCity('深圳市')?.name).toBe('深圳')
    expect(findCity('杭州')?.name).toBe('杭州')
  })

  it('resolves a province name to its first city', () => {
    expect(findCity('海南省')?.name).toBe('海口')
  })

  it('resolves a full address by substring', () => {
    expect(findCity('广东省深圳市南山区')?.name).toBe('深圳')
  })

  it('returns null for unknown names', () => {
    expect(findCity('不存在的城市')).toBeNull()
    expect(findCity('   ')).toBeNull()
  })
})
