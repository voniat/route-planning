import { describe, expect, it } from 'vitest'
import { AppError } from './errors'
import { describeCode, parseForecast } from './weather'

const sample = {
  current: {
    temperature_2m: 26.4,
    apparent_temperature: 27.2,
    weather_code: 61,
    wind_speed_10m: 12.3
  },
  daily: {
    time: ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'],
    weather_code: [0, 61, 3, 80],
    temperature_2m_max: [29.2, 25.1, 24.6, 23.2],
    temperature_2m_min: [18.6, 17.4, 16.9, 15.1],
    precipitation_probability_max: [10, 80, 130, -5]
  }
}

describe('parseForecast', () => {
  it('parses current weather and seven-day forecast', () => {
    const data = parseForecast(sample, new Date(2026, 8, 23))
    expect(data.current.text).toBe('小雨')
    expect(data.current.temperature).toBe(26)
    expect(data.current.apparent).toBe(27)
    expect(data.current.wind).toBe(12)
    expect(data.days).toHaveLength(4)
    expect(data.days[0]?.label).toBe('今天')
    expect(data.days[1]?.label).toBe('明天')
    expect(data.days[2]?.label).toBe('后天')
    expect(data.days[3]?.label).toBe('9/26')
    expect(data.days[1]?.rain).toBe(80)
  })

  it('clamps precipitation into a percentage', () => {
    const data = parseForecast(sample, new Date(2026, 8, 23))
    expect(data.days[2]?.rain).toBe(100)
    expect(data.days[3]?.rain).toBe(0)
  })

  it('throws a weather AppError for invalid payloads', () => {
    expect(() => parseForecast({})).toThrowError(AppError)
    expect(() => parseForecast({ daily: { time: [] } })).toThrowError(/天气数据暂不可用/)
  })
})

describe('describeCode', () => {
  it('maps known codes and falls back for unknown ones', () => {
    expect(describeCode(61)).toEqual({ text: '小雨', icon: '🌦' })
    expect(describeCode(1234)).toEqual({ text: '天气变化', icon: '🌤' })
  })
})
