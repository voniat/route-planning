import { useState } from 'react'
import type { City } from '../core/cities'
import type { WeatherState } from '../hooks/useWeather'

interface WeatherCardProps {
  city: City
  state: WeatherState
  onRetry: () => void
}

export default function WeatherCard({ city, state, onRetry }: WeatherCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (state.status === 'loading') {
    return (
      <section className="weather-card" aria-label="天气">
        <p className="status-text" role="status">
          天气加载中…
        </p>
      </section>
    )
  }

  if (state.status === 'error' || !state.data) {
    return (
      <section className="weather-card" aria-label="天气">
        <button type="button" className="weather-error" onClick={onRetry}>
          {state.error || '天气获取失败'} · 点击重试
        </button>
      </section>
    )
  }

  const data = state.data
  return (
    <section className="weather-card" aria-label="天气">
      <div className="weather-current">
        <span className="weather-icon" aria-hidden="true">
          {data.current.icon}
        </span>
        <span className="weather-main">
          <span className="weather-temp">{data.current.temperature}°</span>
          <span className="weather-desc">
            {city.name} · {data.current.text}
          </span>
        </span>
        <button
          type="button"
          className="weather-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? '收起' : '7 日'}
        </button>
      </div>
      <div className="weather-meta">
        <span>体感 {data.current.apparent}°</span>
        <span>风速 {data.current.wind} km/h</span>
      </div>
      {expanded && (
        <div className="weather-days">
          {data.days.map((day) => (
            <div key={day.date} className="weather-day">
              <span>{day.label}</span>
              <span aria-hidden="true">{day.icon}</span>
              <span>
                {day.high}° / {day.low}°
              </span>
              <span className="weather-day-rain">降水 {day.rain}%</span>
            </div>
          ))}
        </div>
      )}
      {expanded && <p className="weather-source">天气数据：Open-Meteo · CC BY 4.0</p>}
    </section>
  )
}
