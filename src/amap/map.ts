import type { Point } from '../core/points'
import type { PolylineView } from './route'
import type { AmapMap, AmapNamespace, AmapOverlay, LngLat } from './types'

export interface MapFocus {
  lng: number
  lat: number
  zoom: number
  nonce: number
}

export interface MapHandle {
  map: AmapMap
  renderMarkers(points: readonly Point[]): void
  renderPolylines(polylines: readonly PolylineView[]): void
  fitPoints(points: readonly Point[]): void
  fitPolylines(): void
  focus(target: MapFocus): void
  onPick(handler: (lngLat: LngLat) => void): () => void
  destroy(): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readClickEvent(event: unknown): LngLat | null {
  if (!isRecord(event)) return null
  const lngLat = event.lnglat
  if (!isRecord(lngLat)) return null
  const lng = lngLat.lng
  const lat = lngLat.lat
  if (typeof lng !== 'number' || typeof lat !== 'number') return null
  return { lng, lat }
}

function markerContent(index: number, total: number): string {
  if (index === 0) return '<div class="map-marker start">起</div>'
  if (index === total - 1) return '<div class="map-marker end">终</div>'
  return `<div class="map-marker mid">${index}</div>`
}

export function createMap(amap: AmapNamespace, container: HTMLElement): MapHandle {
  const map = new amap.Map(container, {
    zoom: 11,
    center: [116.4074, 39.9042],
    viewMode: '2D',
    resizeEnable: true
  })
  map.addControl(new amap.ToolBar({ position: 'RB' }))

  let markers: AmapOverlay[] = []
  let polylineOverlays: AmapOverlay[] = []
  const pickHandlers = new Set<(lngLat: LngLat) => void>()
  const clickHandler = (event: unknown) => {
    const lngLat = readClickEvent(event)
    if (!lngLat) return
    for (const handler of pickHandlers) handler(lngLat)
  }
  map.on('click', clickHandler)

  function renderMarkers(points: readonly Point[]): void {
    map.remove(markers)
    markers = []
    points.forEach((point, index) => {
      const marker = new amap.Marker({
        position: [point.lng, point.lat],
        content: markerContent(index, points.length),
        anchor: 'center',
        zIndex: 100 + index,
        title: point.title
      })
      markers.push(marker)
    })
    if (markers.length > 0) map.add(markers)
  }

  function renderPolylines(polylines: readonly PolylineView[]): void {
    map.remove(polylineOverlays)
    polylineOverlays = polylines
      .filter((polyline) => polyline.path.length > 1)
      .map(
        (polyline) =>
          new amap.Polyline({
            path: polyline.path,
            strokeColor: polyline.color,
            strokeWeight: polyline.width,
            strokeOpacity: 1,
            strokeStyle: polyline.dotted ? 'dashed' : 'solid',
            isOutline: true,
            outlineColor: '#ffffff',
            lineJoin: 'round'
          })
      )
    if (polylineOverlays.length > 0) map.add(polylineOverlays)
  }

  function fitPoints(points: readonly Point[]): void {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setCenter([points[0].lng, points[0].lat])
      map.setZoom(14)
      return
    }
    map.setFitView(markers, false, [60, 60, 60, 60])
  }

  function fitPolylines(): void {
    if (polylineOverlays.length === 0) return
    map.setFitView(polylineOverlays, false, [70, 70, 70, 70])
  }

  function focus(target: MapFocus): void {
    map.setCenter([target.lng, target.lat])
    map.setZoom(target.zoom)
  }

  function onPick(handler: (lngLat: LngLat) => void): () => void {
    pickHandlers.add(handler)
    return () => pickHandlers.delete(handler)
  }

  function destroy(): void {
    map.off('click', clickHandler)
    pickHandlers.clear()
    markers = []
    polylineOverlays = []
    map.destroy()
  }

  return { map, renderMarkers, renderPolylines, fitPoints, fitPolylines, focus, onPick, destroy }
}
