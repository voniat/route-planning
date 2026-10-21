import { AppError } from '../core/errors'
import type { AmapNamespace, LngLat } from './types'

export interface ReverseGeocodeResult {
  address: string
  city: string
  province: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readCity(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter((part): part is string => typeof part === 'string').join('')
  return ''
}

export function reverseGeocode(amap: AmapNamespace, lngLat: LngLat): Promise<ReverseGeocodeResult> {
  return new Promise((resolve, reject) => {
    const geocoder = new amap.Geocoder({ radius: 500 })
    geocoder.getAddress([lngLat.lng, lngLat.lat], (status, result) => {
      if (status !== 'complete' || !isRecord(result) || !isRecord(result.regeocode)) {
        reject(new AppError('GEO', '无法解析该位置的地址'))
        return
      }
      const regeocode = result.regeocode
      const component = isRecord(regeocode.addressComponent) ? regeocode.addressComponent : {}
      const province = readString(component.province)
      const city = readCity(component.city) || province
      resolve({
        address: readString(regeocode.formattedAddress),
        city,
        province
      })
    })
  })
}
