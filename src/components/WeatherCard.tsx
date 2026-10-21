import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { City } from '../core/cities'
import type { WeatherState } from '../hooks/useWeather'
import weatherWidget from '../assets/weather-widget.png'

interface WeatherCardProps {
  city: City
  state: WeatherState
  onRetry: () => void
}

interface BubbleDrag {
  startX: number
  startY: number
  originX: number
  originY: number
  pointerId: number
  moved: boolean
}

const BUBBLE_SIZE = 56
const BUBBLE_MARGIN = 8
const MOBILE_QUERY = '(max-width: 899px)'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export default function WeatherCard({ city, state, onRetry }: WeatherCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  )
  const [collapsed, setCollapsed] = useState(false)
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const bubbleRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<BubbleDrag | null>(null)
  const suppressClick = useRef(false)
  const current = state.data?.current
  const useWeatherArt =
    isMobile &&
    Boolean(
      current &&
        (current.text.includes('晴') ||
          current.text.includes('多云') ||
          current.icon === '⛅' ||
          current.icon === '🌤️')
    )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!isMobile) setCollapsed(false)
  }, [isMobile])

  useEffect(() => {
    if (collapsed && isMobile) bubbleRef.current?.focus()
  }, [collapsed, isMobile])

  useEffect(() => {
    if (!collapsed) return
    const onResize = () => {
      setBubblePos((position) => {
        if (!position) return position
        return {
          x: clamp(position.x, BUBBLE_MARGIN, window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN),
          y: clamp(position.y, BUBBLE_MARGIN, window.innerHeight - BUBBLE_SIZE - BUBBLE_MARGIN)
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [collapsed])

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      pointerId: event.pointerId,
      moved: false
    }
    suppressClick.current = false
    setDragging(true)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    const maxX = Math.max(BUBBLE_MARGIN, window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN)
    const maxY = Math.max(BUBBLE_MARGIN, window.innerHeight - BUBBLE_SIZE - BUBBLE_MARGIN)
    setBubblePos({
      x: clamp(drag.originX + dx, BUBBLE_MARGIN, maxX),
      y: clamp(drag.originY + dy, BUBBLE_MARGIN, maxY)
    })
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current
    if (drag) {
      try {
        event.currentTarget.releasePointerCapture(drag.pointerId)
      } catch {
        // 指针已经释放时忽略。
      }
      if (drag.moved) suppressClick.current = true
    }
    dragRef.current = null
    setDragging(false)
  }

  function handleBubbleClick(): void {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setCollapsed(false)
  }

  function hideWeather(): void {
    setExpanded(false)
    setCollapsed(true)
  }

  if (isMobile && collapsed) {
    return (
      <button
        ref={bubbleRef}
        type="button"
        className={dragging ? 'weather-bubble dragging' : 'weather-bubble'}
        style={bubblePos ? { left: bubblePos.x, top: bubblePos.y, right: 'auto' } : undefined}
        aria-label={
          current
            ? `展开天气，${city.name} ${current.temperature}° ${current.text}`
            : '展开天气'
        }
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          dragRef.current = null
          setDragging(false)
        }}
        onClick={handleBubbleClick}
      >
        {useWeatherArt ? (
          <img className="weather-art weather-bubble-art" src={weatherWidget} alt="" aria-hidden="true" />
        ) : (
          <span aria-hidden="true">{current?.icon ?? '☁️'}</span>
        )}
      </button>
    )
  }

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
        {useWeatherArt ? (
          <span className="weather-art-badge" aria-hidden="true">
            <img className="weather-art weather-card-art" src={weatherWidget} alt="" />
          </span>
        ) : (
          <span className="weather-icon" aria-hidden="true">
            {data.current.icon}
          </span>
        )}
        <span className="weather-main">
          <span className="weather-temp">{data.current.temperature}°</span>
          <span className="weather-desc">
            {city.name} · {data.current.text}
          </span>
        </span>
        <div className="weather-actions">
          <button
            type="button"
            className="weather-toggle"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? '收起' : '7 日'}
          </button>
          <button
            type="button"
            className="weather-hide"
            aria-label="隐藏天气卡片"
            onClick={hideWeather}
          >
            隐藏
          </button>
        </div>
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
