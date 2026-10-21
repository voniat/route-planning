import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import CityDialog from './components/CityDialog'
import ConfirmDialog from './components/ConfirmDialog'
import MapView from './components/MapView'
import PointList from './components/PointList'
import RoutePanel from './components/RoutePanel'
import SaveRouteDialog from './components/SaveRouteDialog'
import SavedPanel from './components/SavedPanel'
import SearchOverlay from './components/SearchOverlay'
import TextDialog from './components/TextDialog'
import Toast from './components/Toast'
import WeatherCard from './components/WeatherCard'
import { hasAmapKey, loadAmap } from './amap/load'
import { reverseGeocode } from './amap/geocode'
import type { MapFocus } from './amap/map'
import type { LngLat } from './amap/types'
import type { PlaceResult } from './amap/search'
import { useRoutePlans, type RouteMode } from './hooks/useRoutePlans'
import { useWeather } from './hooks/useWeather'
import { findCity, DEFAULT_CITY, type City } from './core/cities'
import { clearDraft, loadDraft, saveDraft } from './core/draft'
import { createFavoriteStore, type SavedRoute } from './core/favorites'
import { buildItineraryText } from './core/itinerary'
import { MAX_POINTS, isDuplicateCoordinate, normalizePoints } from './core/points'
import { decodeShare, encodeShare } from './core/share'
import {
  STORAGE_KEYS,
  createMemoryStorage,
  getBrowserStorage,
  readJson,
  writeJson,
  type StorageLike
} from './core/storage'
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

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 回退到旧式复制。
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}

function locateUser(): Promise<{ lng: number; lat: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lng: position.coords.longitude, lat: position.coords.latitude }),
      () => reject(new Error('未获取定位，请检查浏览器权限')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    )
  })
}

export default function App() {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState)
  const persistentStorage = useMemo(() => getBrowserStorage(), [])
  const memoryStorage = useMemo(() => createMemoryStorage(), [])
  const storage = persistentStorage ?? memoryStorage
  const storagePersistent = persistentStorage !== null
  const favoriteStore = useMemo(() => createFavoriteStore(storage), [storage])
  const [history, setHistory] = useState<string[]>(() => readHistory(storage))
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => favoriteStore.list())
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)
  const [activeSegment, setActiveSegment] = useState(0)
  const [routeMode, setRouteMode] = useState<RouteMode>('transit')
  const [saveOpen, setSaveOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [pendingLoadId, setPendingLoadId] = useState<number | null>(null)
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [manualText, setManualText] = useState<{ title: string; text: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastAction, setToastAction] = useState<{ label: string; run: () => void } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const pointsCount = useRef(0)
  const draftLoaded = useRef(false)
  const cityTouched = useRef(false)
  const draftFailed = useRef(false)
  const shareApplied = useRef(false)

  const showToast = useCallback(
    (message: string, action?: { label: string; run: () => void }) => {
      setToast(message)
      setToastAction(action ?? null)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(
        () => {
          setToast(null)
          setToastAction(null)
        },
        action ? 4500 : 2600
      )
    },
    []
  )

  useEffect(() => {
    if (!storagePersistent) {
      showToast('浏览器存储不可用，草稿和收藏只保存在本次会话')
    }
  }, [storagePersistent, showToast])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const search = window.location.search
    if (!search || !new URLSearchParams(search).has('p')) return
    const payload = decodeShare(search)
    if (!payload) {
      window.history.replaceState(null, '', window.location.pathname)
      showToast('分享链接无效，已恢复本地草稿')
      return
    }
    shareApplied.current = true
    const city = payload.city ? findCity(payload.city) : null
    dispatch({ type: 'replace-points', points: payload.points, city: city ?? undefined })
    saveDraft(storage, payload.points, city?.name ?? DEFAULT_CITY.name)
    window.history.replaceState(null, '', window.location.pathname)
    showToast('已载入分享路线')
  }, [storage, showToast])

  useEffect(() => {
    pointsCount.current = state.points.length
  }, [state.points.length])

  useEffect(() => {
    if (selectedPointId && !state.points.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null)
    }
  }, [state.points, selectedPointId])

  useEffect(() => {
    if (draftLoaded.current || shareApplied.current) return
    draftLoaded.current = true
    const draft = loadDraft(storage)
    if (!draft) return
    const city = draft.city ? findCity(draft.city) : null
    dispatch({ type: 'replace-points', points: draft.points, city: city ?? undefined })
    showToast('已恢复上次草稿')
  }, [storage, showToast])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (state.points.length === 0) {
        clearDraft(storage)
        return
      }
      if (!saveDraft(storage, state.points, state.city.name) && !draftFailed.current) {
        draftFailed.current = true
        showToast('草稿保存失败，页面数据仍会保留')
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [state.points, state.city.name, storage, showToast])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
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
    cityTouched.current = true
    dispatch({ type: 'set-city', city })
    setCityOpen(false)
    setFocus({ lng: city.lng, lat: city.lat, zoom: 11, nonce: Date.now() })
  }, [])

  const removePoint = useCallback(
    (id: string) => {
      const index = state.points.findIndex((point) => point.id === id)
      if (index < 0) return
      const removed = state.points[index]
      dispatch({ type: 'remove-point', id })
      if (removed) {
        showToast('已删除途经点', {
          label: '撤销',
          run: () => dispatch({ type: 'insert-point', point: removed, index })
        })
      }
    },
    [state.points, showToast]
  )

  const clearPoints = useCallback(() => {
    const previousPoints = state.points
    dispatch({ type: 'clear' })
    clearDraft(storage)
    setClearOpen(false)
    showToast('已清空途经点', {
      label: '撤销',
      run: () => dispatch({ type: 'replace-points', points: previousPoints })
    })
  }, [state.points, storage, showToast])

  const route = useRoutePlans(state.points, state.city, routeOpen, activeSegment, routeMode)
  const routePolylines = useMemo(() => {
    if (!routeOpen) return []
    if (routeMode === 'walking') return route.walking ? [route.walking.polyline] : []
    const plan = route.plans[route.planIndex]
    return plan ? plan.polylines : []
  }, [routeOpen, routeMode, route.plans, route.planIndex, route.walking])

  const openRoute = useCallback(() => {
    setPickMode(false)
    setActiveSegment(0)
    setRouteMode('transit')
    setRouteOpen(true)
  }, [])

  const handleMarkerClick = useCallback(
    (index: number) => {
      const point = state.points[index]
      if (!point) return
      if (routeOpen) setRouteOpen(false)
      setSelectedPointId(point.id)
    },
    [state.points, routeOpen]
  )

  const handleLocate = useCallback(async () => {
    try {
      const lngLat = await locateUser()
      setFocus({ ...lngLat, zoom: 14, nonce: Date.now() })
    } catch (error) {
      showToast(error instanceof Error ? error.message : '定位失败')
    }
  }, [showToast])

  const handleUseMyLocation = useCallback(async () => {
    if (state.points.length >= MAX_POINTS) {
      showToast(`最多添加 ${MAX_POINTS} 个途经点`)
      return
    }
    try {
      const lngLat = await locateUser()
      if (isDuplicateCoordinate(state.points, lngLat.lat, lngLat.lng)) {
        showToast('当前位置已在路线中')
        return
      }
      let address = formatLngLat(lngLat)
      try {
        const amap = await loadAmap()
        const result = await reverseGeocode(amap, lngLat)
        if (result.address) address = result.address
      } catch {
        // 反地理编码失败时使用坐标作为标题。
      }
      const point = normalizePoints(
        [{ title: address, address, lat: lngLat.lat, lng: lngLat.lng }],
        1
      )[0]
      if (!point) {
        showToast('无效坐标')
        return
      }
      if (state.points.length === 0) {
        dispatch({ type: 'add-point', point })
      } else {
        dispatch({ type: 'replace-points', points: [point, ...state.points] })
      }
      setFocus({ ...lngLat, zoom: 14, nonce: Date.now() })
      showToast('已把当前位置设为起点')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '定位失败')
    }
  }, [state.points, showToast])

  const weather = useWeather(state.city)

  const refreshFavorites = useCallback(() => {
    setSavedRoutes(favoriteStore.list())
  }, [favoriteStore])

  const openSavedPanel = useCallback(() => {
    refreshFavorites()
    setSavedOpen(true)
  }, [refreshFavorites])

  const defaultRouteName =
    state.points.length > 0
      ? `${state.points[0]?.title ?? ''} 等${state.points.length}站`
      : '未命名路线'

  const handleSaveRoute = useCallback(
    (name: string) => {
      const result = favoriteStore.add(state.points, state.city.name, name)
      if (!result) {
        showToast('收藏失败，请重试')
        return
      }
      setSavedRoutes(favoriteStore.list())
      setSaveOpen(false)
      showToast(result.droppedOldest ? '已收藏，并自动删除最旧路线' : '已收藏路线')
    },
    [favoriteStore, state.points, state.city.name, showToast]
  )

  const applyLoadSavedRoute = useCallback(
    (id: number) => {
      const saved = favoriteStore.getById(id)
      if (!saved) {
        refreshFavorites()
        showToast('收藏不存在')
        return
      }
      const points = normalizePoints(saved.points, MAX_POINTS)
      if (points.length === 0) {
        showToast('收藏数据无效')
        return
      }
      const city = saved.city ? findCity(saved.city) : null
      dispatch({ type: 'replace-points', points, city: city ?? undefined })
      setSavedOpen(false)
      setRouteOpen(false)
      setPickMode(false)
      const last = points[points.length - 1]
      if (last) setFocus({ lng: last.lng, lat: last.lat, zoom: 14, nonce: Date.now() })
      showToast('已加载收藏')
    },
    [favoriteStore, refreshFavorites, showToast]
  )

  const requestLoadSavedRoute = useCallback(
    (id: number) => {
      if (state.points.length > 0) {
        setPendingLoadId(id)
        return
      }
      applyLoadSavedRoute(id)
    },
    [state.points.length, applyLoadSavedRoute]
  )

  const confirmLoadSavedRoute = useCallback(() => {
    if (pendingLoadId === null) return
    applyLoadSavedRoute(pendingLoadId)
    setPendingLoadId(null)
  }, [pendingLoadId, applyLoadSavedRoute])

  const confirmDeleteSaved = useCallback(() => {
    if (deleteId === null) return
    const removed = favoriteStore.remove(deleteId)
    setDeleteId(null)
    if (!removed) {
      showToast('删除失败，请重试')
      return
    }
    refreshFavorites()
    showToast('已删除收藏')
  }, [deleteId, favoriteStore, refreshFavorites, showToast])

  const shareRoute = useCallback(async () => {
    const search = encodeShare(state.points, state.city.name)
    if (!search) {
      showToast('路线太长，无法生成分享链接')
      return
    }
    const url = `${window.location.origin}${window.location.pathname}?${search}`
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: state.city.name ? `旅行路线 · ${state.city.name}` : '旅行路线',
          text: `${state.points.length} 个地点`,
          url
        })
        showToast('已分享')
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    const copied = await copyText(url)
    if (copied) {
      showToast('分享链接已复制')
    } else {
      setManualText({ title: '手动复制分享链接', text: url })
      showToast('复制失败，已打开手动复制')
    }
  }, [state.points, state.city.name, showToast])

  const copyItinerary = useCallback(async () => {
    const text = buildItineraryText(state.points, state.city.name)
    const copied = await copyText(text)
    if (copied) {
      showToast('行程已复制')
    } else {
      setManualText({ title: '手动复制行程', text })
      showToast('复制失败，已打开手动复制')
    }
  }, [state.points, state.city.name, showToast])

  useEffect(() => {
    if (!hasAmapKey() || pointsCount.current > 0) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled || pointsCount.current > 0 || cityTouched.current) return
        const lngLat = { lng: position.coords.longitude, lat: position.coords.latitude }
        setFocus({ ...lngLat, zoom: 14, nonce: Date.now() })
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

        {routeOpen ? (
          <RoutePanel
            points={state.points}
            activeSegment={activeSegment}
            mode={routeMode}
            state={route}
            onSegmentChange={setActiveSegment}
            onModeChange={setRouteMode}
            onSelectPlan={route.selectPlan}
            onRetry={route.retry}
            onBack={() => setRouteOpen(false)}
          />
        ) : (
          <>
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

            <div className="location-row">
              <button
                type="button"
                className="btn location-button"
                disabled={!mapReady}
                onClick={() => void handleUseMyLocation()}
              >
                ◎ 以当前位置为起点
              </button>
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
                <>
                  <PointList
                    points={state.points}
                    selectedId={selectedPointId}
                    onRemove={removePoint}
                    onMove={(from, to) => dispatch({ type: 'move-point', from, to })}
                  />
                  <button type="button" className="link-button" onClick={() => setClearOpen(true)}>
                    清空全部
                  </button>
                </>
              )}
              {state.points.length === 1 && <p className="inline-hint">至少 2 个点才能规划路线</p>}
            </section>

            {state.points.length > 0 && (
              <div className="secondary-actions">
                <button type="button" className="btn" onClick={() => setSaveOpen(true)}>
                  ⭐ 收藏路线
                </button>
                <button type="button" className="btn" onClick={openSavedPanel}>
                  收藏 ({savedRoutes.length})
                </button>
                <button type="button" className="btn" onClick={() => void shareRoute()}>
                  分享链接
                </button>
                <button type="button" className="btn" onClick={() => void copyItinerary()}>
                  复制行程
                </button>
              </div>
            )}

            {state.points.length >= 2 && (
              <button
                type="button"
                className="btn primary route-open-button"
                disabled={!mapReady}
                onClick={openRoute}
              >
                查看交通路线
              </button>
            )}
          </>
        )}
      </aside>

      <main className="map-area">
        <MapView
          points={state.points}
          polylines={routePolylines}
          pickMode={pickMode}
          focus={focus}
          onPick={handlePick}
          onMarkerClick={handleMarkerClick}
          onReady={() => setMapReady(true)}
          onError={() => setMapReady(false)}
        />
        {!routeOpen && (
          <div className="mobile-topbar">
            <button type="button" className="mobile-city" onClick={() => setCityOpen(true)}>
              {state.city.name} ▾
            </button>
            <button
              type="button"
              className="mobile-search"
              disabled={!mapReady}
              onClick={() => setSearchOpen(true)}
            >
              🔍 搜索地点
            </button>
          </div>
        )}
        <button
          type="button"
          className="map-locate"
          aria-label="定位到当前位置"
          onClick={() => void handleLocate()}
        >
          ◎
        </button>
        <div className="weather-float">
          <WeatherCard city={state.city} state={weather} onRetry={weather.retry} />
        </div>
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

      <ConfirmDialog
        open={clearOpen}
        title="清空途经点？"
        message="将删除所有途经点，地图标记与草稿也会清除。"
        confirmText="清空"
        onConfirm={clearPoints}
        onCancel={() => setClearOpen(false)}
      />

      <SaveRouteDialog
        open={saveOpen}
        defaultName={defaultRouteName}
        onCancel={() => setSaveOpen(false)}
        onSave={handleSaveRoute}
      />

      <SavedPanel
        open={savedOpen}
        routes={savedRoutes}
        onClose={() => setSavedOpen(false)}
        onLoad={requestLoadSavedRoute}
        onDelete={setDeleteId}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="删除收藏？"
        message="这条收藏将从本机删除。"
        confirmText="删除"
        onConfirm={confirmDeleteSaved}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={pendingLoadId !== null}
        title="加载收藏？"
        message="当前路线将被这条收藏替换。"
        confirmText="加载"
        onConfirm={confirmLoadSavedRoute}
        onCancel={() => setPendingLoadId(null)}
      />

      <TextDialog
        open={manualText !== null}
        title={manualText?.title ?? ''}
        text={manualText?.text ?? ''}
        onClose={() => setManualText(null)}
      />

      <Toast
        message={toast}
        actionLabel={toastAction?.label}
        onAction={
          toastAction
            ? () => {
                const run = toastAction.run
                setToast(null)
                setToastAction(null)
                run()
              }
            : undefined
        }
      />
    </div>
  )
}
