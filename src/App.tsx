import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import CityDialog from './components/CityDialog'
import ConfirmDialog from './components/ConfirmDialog'
import MapView from './components/MapView'
import SearchOverlay from './components/SearchOverlay'
import Toast from './components/Toast'
import { hasAmapKey, loadAmap } from './amap/load'
import { reverseGeocode } from './amap/geocode'
import type { MapFocus } from './amap/map'
import type { LngLat } from './amap/types'
import type { PlaceResult } from './amap/search'
import { findCity, type City } from './core/cities'
import { MAX_POINTS, isDuplicateCoordinate, normalizePoints } from './core/points'
import { STORAGE_KEYS, getBrowserStorage, readJson, writeJson, type StorageLike } from './core/storage'
import { initialPlannerState, plannerReducer } from './state/planner'

interface PendingPick {
  lng: number
  lat: number
  address: string
}

function readHistory(storage: StorageLike | null): string[] {
  const raw = readJson<unknown>(storage, STORAGE_KEYS.searchHistory)
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string').slice(0, 10)
}

function formatLngLat(lngLat: LngLat): string {
  return `${lngLat.lng.toFixed(4)}, ${lngLat.lat.toFixed(4)}`
}

export default function App() {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState)
  const storage = useMemo(() => getBrowserStorage(), [])
  const [history, setHistory] = useState<string[]>(() => readHistory(storage))
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const pointsCount = useRef(0)

  useEffect(() => {
    pointsCount.current = state.points.length
  }, [state.points.length])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const updateHistory = useCallback(
    (next: string[]) => {
      setHistory(next)
      writeJson(storage, STORAGE_KEYS.searchHistory, next)
    },
    [storage]
  )

  const addPoint = useCallback(
    (input: { title: string; address?: string; lat: number; lng: number }): boolean => {
      if (state.points.length >= MAX_POINTS) {
        showToast(`最多添加 ${MAX_POINTS} 个途经点`)
        return false
      }
      if (isDuplicateCoordinate(state.points, input.lat, input.lng)) {
        showToast('该地点已在路线中')
        return false
      }
      const point = normalizePoints(
        [{ title: input.title, address: input.address, lat: input.lat, lng: input.lng }],
        1
      )[0]
      if (!point) {
        showToast('无效坐标')
        return false
      }
      dispatch({ type: 'add-point', point })
      return true
    },
    [state.points, showToast]
  )

  const handleAddPlace = useCallback(
    (place: PlaceResult) => {
      if (addPoint({ title: place.title, address: place.address, lat: place.lat, lng: place.lng })) {
        setSearchOpen(false)
      }
    },
    [addPoint]
  )

  const handlePick = useCallback((lngLat: LngLat) => {
    setPickMode(false)
    loadAmap()
      .then((amap) => reverseGeocode(amap, lngLat))
      .then((result) => {
        const address = result.address || formatLngLat(lngLat)
        setPendingPick({ lng: lngLat.lng, lat: lngLat.lat, address })
      })
      .catch(() => {
        setPendingPick({ lng: lngLat.lng, lat: lngLat.lat, address: formatLngLat(lngLat) })
      })
  }, [])

  const confirmPending = useCallback(() => {
    if (!pendingPick) return
    addPoint({
      title: pendingPick.address,
      address: pendingPick.address,
      lat: pendingPick.lat,
      lng: pendingPick.lng
    })
    setPendingPick(null)
  }, [addPoint, pendingPick])

  const confirmCity = useCallback((city: City) => {
    dispatch({ type: 'set-city', city })
    setCityOpen(false)
    setFocus({ lng: city.lng, lat: city.lat, zoom: 11, nonce: Date.now() })
  }, [])

  useEffect(() => {
    if (!hasAmapKey() || pointsCount.current > 0) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return
        const lngLat = { lng: position.coords.longitude, lat: position.coords.latitude }
        if (pointsCount.current === 0) {
          setFocus({ ...lngLat, zoom: 14, nonce: Date.now() })
        }
        void loadAmap()
          .then((amap) => reverseGeocode(amap, lngLat))
          .then((result) => {
            if (cancelled) return
            const city = findCity(result.city) ?? findCity(result.province)
            if (city) dispatch({ type: 'set-city', city })
          })
          .catch(() => {})
      },
      () => {
        if (!cancelled) showToast('未获取定位，已使用北京')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    )
    return () => {
      cancelled = true
    }
  }, [showToast])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <header className="brand">
          <h1>旅行路线规划</h1>
          <p>地图选点，查看公交/地铁与步行方案</p>
        </header>

        <div className="planner-actions">
          <button type="button" className="city-button" onClick={() => setCityOpen(true)}>
            <span className="city-dot" aria-hidden="true">
              ◎
            </span>
            <span>{state.city.name}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <button
            type="button"
            className="search-button"
            disabled={!mapReady}
            onClick={() => setSearchOpen(true)}
          >
            🔍 搜索地点添加途经点
          </button>
        </div>

        <div className="pick-row">
          <button
            type="button"
            className={pickMode ? 'pick-button active' : 'pick-button'}
            disabled={!mapReady}
            onClick={() => setPickMode((value) => !value)}
          >
            {pickMode ? '取消地图选点' : '＋ 地图选点'}
          </button>
          <span className="pick-hint">
            {pickMode ? '点击地图添加地点' : '高德地图 · 点击地图可拾取位置'}
          </span>
        </div>

        <section className="point-summary" aria-label="途经点">
          <div className="section-head">
            <h2>途经点</h2>
            <span>
              {state.points.length} / {MAX_POINTS}
            </span>
          </div>
          {state.points.length === 0 ? (
            <div className="empty-state">
              <p>还没有地点。</p>
              <p className="muted">搜索或点地图添加第一个地点。</p>
            </div>
          ) : (
            <ol className="summary-list">
              {state.points.map((point, index) => (
                <li key={point.id}>
                  <span
                    className={
                      index === 0
                        ? 'summary-index start'
                        : index === state.points.length - 1
                          ? 'summary-index end'
                          : 'summary-index'
                    }
                  >
                    {index === 0 ? '起' : index === state.points.length - 1 ? '终' : index}
                  </span>
                  <span className="summary-title">{point.title}</span>
                </li>
              ))}
            </ol>
          )}
          {state.points.length === 1 && <p className="inline-hint">至少 2 个点才能规划路线</p>}
        </section>
      </aside>

      <main className="map-area">
        <MapView
          points={state.points}
          pickMode={pickMode}
          focus={focus}
          onPick={handlePick}
          onReady={() => setMapReady(true)}
          onError={() => setMapReady(false)}
        />
      </main>

      <SearchOverlay
        open={searchOpen}
        city={state.city}
        points={state.points}
        history={history}
        onHistoryChange={updateHistory}
        onClose={() => setSearchOpen(false)}
        onAdd={handleAddPlace}
      />

      <CityDialog
        open={cityOpen}
        value={state.city}
        onClose={() => setCityOpen(false)}
        onConfirm={confirmCity}
      />

      <ConfirmDialog
        open={pendingPick !== null}
        title="添加此地点？"
        message={pendingPick?.address ?? ''}
        confirmText="添加"
        onConfirm={confirmPending}
        onCancel={() => setPendingPick(null)}
      />

      <Toast message={toast} />
    </div>
  )
}
