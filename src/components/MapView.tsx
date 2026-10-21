import { useEffect, useRef, useState } from 'react'
import { AppError } from '../core/errors'
import type { Point } from '../core/points'
import type { LngLat } from '../amap/types'
import type { PolylineView } from '../amap/route'
import { loadAmap } from '../amap/load'
import { createMap, type MapFocus, type MapHandle } from '../amap/map'

interface MapViewProps {
  points: Point[]
  polylines?: PolylineView[]
  pickMode: boolean
  focus: MapFocus | null
  onPick: (lngLat: LngLat) => void
  onReady?: () => void
  onError?: () => void
}

export default function MapView({
  points,
  polylines = [],
  pickMode,
  focus,
  onPick,
  onReady,
  onError
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<MapHandle | null>(null)
  const pointsRef = useRef(points)
  const polylinesRef = useRef<PolylineView[]>(polylines)
  const focusRef = useRef(focus)
  const pickModeRef = useRef(pickMode)
  const onPickRef = useRef(onPick)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  const pointSetKey = useRef('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    pickModeRef.current = pickMode
  }, [pickMode])

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    onReadyRef.current = onReady
    onErrorRef.current = onError
  }, [onReady, onError])

  useEffect(() => {
    pointsRef.current = points
    const key = points
      .map((point) => point.id)
      .sort()
      .join('|')
    const setChanged = key !== pointSetKey.current
    pointSetKey.current = key
    const handle = handleRef.current
    if (!handle) return
    handle.renderMarkers(points)
    if (setChanged && polylinesRef.current.length === 0) handle.fitPoints(points)
  }, [points])

  useEffect(() => {
    polylinesRef.current = polylines
    const handle = handleRef.current
    if (!handle) return
    handle.renderPolylines(polylines)
    if (polylines.length > 0) {
      handle.fitPolylines()
    } else if (pointsRef.current.length > 0) {
      handle.fitPoints(pointsRef.current)
    }
  }, [polylines])

  useEffect(() => {
    focusRef.current = focus
    if (focus && handleRef.current) handleRef.current.focus(focus)
  }, [focus])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError('')
    loadAmap()
      .then((amap) => {
        if (cancelled || !containerRef.current) return
        const handle = createMap(amap, containerRef.current)
        handleRef.current = handle
        handle.onPick((lngLat) => {
          if (pickModeRef.current) onPickRef.current(lngLat)
        })
        handle.renderMarkers(pointsRef.current)
        handle.renderPolylines(polylinesRef.current)
        if (polylinesRef.current.length > 0) handle.fitPolylines()
        else handle.fitPoints(pointsRef.current)
        if (focusRef.current) handle.focus(focusRef.current)
        setStatus('ready')
        onReadyRef.current?.()
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setStatus('error')
        setError(cause instanceof AppError ? cause.message : '地图加载失败')
        onErrorRef.current?.()
      })
    return () => {
      cancelled = true
      handleRef.current?.destroy()
      handleRef.current = null
    }
  }, [attempt])

  return (
    <div className="map-shell">
      <div ref={containerRef} className={pickMode ? 'map-container picking' : 'map-container'} />

      {status === 'loading' && (
        <div className="map-overlay">
          <p className="status-text" role="status">
            正在加载地图…
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="map-overlay">
          <div className="map-error-card">
            <h2>地图未能加载</h2>
            <p>{error}</p>
            <p className="muted">
              请检查 <code>.env.local</code> 中的 <code>VITE_AMAP_KEY</code> 与{' '}
              <code>VITE_AMAP_SECURITY_CODE</code>，以及高德控制台的域名白名单。
            </p>
            <button type="button" className="btn primary" onClick={() => setAttempt((value) => value + 1)}>
              重试
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && pickMode && (
        <div className="map-hint" role="status">
          点击地图选择地点
        </div>
      )}
    </div>
  )
}
