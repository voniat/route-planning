export interface LngLat {
  lng: number
  lat: number
}

export interface AmapOverlay {
  setMap?(map: AmapMap | null): void
  on?(event: string, handler: () => void): void
  off?(event: string, handler: () => void): void
}

export interface AmapMap {
  add(overlay: AmapOverlay | AmapOverlay[]): void
  remove(overlay: AmapOverlay | AmapOverlay[]): void
  setCenter(position: [number, number]): void
  setZoom(zoom: number): void
  setFitView(overlays?: AmapOverlay[], immediately?: boolean, avoid?: number[]): void
  on(event: string, handler: (event: unknown) => void): void
  off(event: string, handler: (event: unknown) => void): void
  addControl(control: unknown): void
  destroy(): void
}

export interface AmapSearchService {
  search(keyword: string, callback: (status: string, result: unknown) => void): void
}

export interface AmapGeocoder {
  getAddress(position: [number, number], callback: (status: string, result: unknown) => void): void
}

export interface AmapNamespace {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => AmapMap
  Marker: new (options: Record<string, unknown>) => AmapOverlay
  ToolBar: new (options?: Record<string, unknown>) => unknown
  PlaceSearch: new (options?: Record<string, unknown>) => AmapSearchService
  AutoComplete: new (options?: Record<string, unknown>) => AmapSearchService
  Geocoder: new (options?: Record<string, unknown>) => AmapGeocoder
}

declare global {
  interface Window {
    AMap?: AmapNamespace
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}
