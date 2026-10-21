import { AppError } from './errors'

export interface WeatherNow {
  temperature: number
  apparent: number
  wind: number
  text: string
  icon: string
}

export interface WeatherDay {
  date: string
  label: string
  text: string
  icon: string
  high: number
  low: number
  rain: number
}

export interface WeatherView {
  current: WeatherNow
  days: WeatherDay[]
}

const WEATHER_CODES: Record<number, readonly [string, string]> = {
  0: ['晴', '☀️'],
  1: ['大部晴朗', '🌤'],
  2: ['多云', '⛅'],
  3: ['阴', '☁️'],
  45: ['有雾', '🌫'],
  48: ['雾凇', '🌫'],
  51: ['小毛毛雨', '🌦'],
  53: ['毛毛雨', '🌦'],
  55: ['较强毛毛雨', '🌧'],
  56: ['冻毛毛雨', '🌧'],
  57: ['较强冻毛毛雨', '🌧'],
  61: ['小雨', '🌦'],
  63: ['中雨', '🌧'],
  65: ['大雨', '🌧'],
  66: ['冻雨', '🌧'],
  67: ['较强冻雨', '🌧'],
  71: ['小雪', '🌨'],
  73: ['中雪', '🌨'],
  75: ['大雪', '❄️'],
  77: ['米雪', '🌨'],
  80: ['小阵雨', '🌦'],
  81: ['阵雨', '🌧'],
  82: ['强阵雨', '🌧'],
  85: ['小阵雪', '🌨'],
  86: ['强阵雪', '❄️'],
  95: ['雷暴', '⛈'],
  96: ['雷暴伴冰雹', '⛈'],
  99: ['强雷暴伴冰雹', '⛈']
}

export function describeCode(code: unknown): { text: string; icon: string } {
  const numeric = typeof code === 'number' ? code : Number(code)
  const value = Number.isFinite(numeric) ? WEATHER_CODES[numeric] : undefined
  return value ? { text: value[0], icon: value[1] } : { text: '天气变化', icon: '🌤' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function dateLabel(dateStr: string, now: Date): string {
  const date = parseDate(dateStr)
  if (!date) return dateStr
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function parseForecast(raw: unknown, now: Date = new Date()): WeatherView {
  if (!isRecord(raw)) throw new AppError('WEATHER', '天气数据暂不可用')

  const daily = isRecord(raw.daily) ? raw.daily : null
  const time = toArray(daily?.time)
  if (!daily || time.length === 0) throw new AppError('WEATHER', '天气数据暂不可用')

  const codes = toArray(daily.weather_code)
  const highs = toArray(daily.temperature_2m_max)
  const lows = toArray(daily.temperature_2m_min)
  const rain = toArray(daily.precipitation_probability_max)

  const days = time.slice(0, 7).map((date, index) => {
    const description = describeCode(codes[index])
    return {
      date: String(date),
      label: dateLabel(String(date), now),
      text: description.text,
      icon: description.icon,
      high: Math.round(toNumber(highs[index])),
      low: Math.round(toNumber(lows[index])),
      rain: Math.max(0, Math.min(100, Math.round(toNumber(rain[index]))))
    }
  })

  const currentRaw = isRecord(raw.current) ? raw.current : {}
  const currentDescription = describeCode(currentRaw.weather_code)

  return {
    current: {
      temperature: Math.round(toNumber(currentRaw.temperature_2m)),
      apparent: Math.round(toNumber(currentRaw.apparent_temperature)),
      wind: Math.round(toNumber(currentRaw.wind_speed_10m)),
      text: currentDescription.text,
      icon: currentDescription.icon
    },
    days
  }
}
