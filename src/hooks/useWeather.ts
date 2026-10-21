import { useCallback, useEffect, useRef, useState } from 'react'
import type { City } from '../core/cities'
import { parseForecast, type WeatherView } from '../core/weather'

export interface WeatherState {
  status: 'loading' | 'ready' | 'error'
  data: WeatherView | null
  error: string
}

export function useWeather(city: City) {
  const [state, setState] = useState<WeatherState>({ status: 'loading', data: null, error: '' })
  const [attempt, setAttempt] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    const controller = new AbortController()
    setState({ status: 'loading', data: null, error: '' })

    const params = new URLSearchParams({
      latitude: String(city.lat),
      longitude: String(city.lng),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '7'
    })

    fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`天气服务返回 ${response.status}`)
        return response.json() as Promise<unknown>
      })
      .then((raw) => {
        if (requestId.current !== id) return
        setState({ status: 'ready', data: parseForecast(raw), error: '' })
      })
      .catch((error: unknown) => {
        if (requestId.current !== id || controller.signal.aborted) return
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : '天气获取失败'
        })
      })

    return () => controller.abort()
  }, [city.lat, city.lng, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { ...state, retry }
}
