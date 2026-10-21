import { AppError } from '../core/errors'
import type { AmapNamespace } from './types'

const SCRIPT_ID = 'amap-js-api'
const TIMEOUT_MS = 8000
const PLUGINS = [
  'AMap.Transfer',
  'AMap.Walking',
  'AMap.PlaceSearch',
  'AMap.AutoComplete',
  'AMap.Geocoder',
  'AMap.ToolBar'
].join(',')

let loading: Promise<AmapNamespace> | null = null

function readEnvValue(value: string | undefined): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed || /^(?:your|replace)-/i.test(trimmed)) return ''
  return trimmed
}

export function hasAmapKey(): boolean {
  return Boolean(
    readEnvValue(import.meta.env.VITE_AMAP_KEY) &&
      readEnvValue(import.meta.env.VITE_AMAP_SECURITY_CODE)
  )
}

export function loadAmap(): Promise<AmapNamespace> {
  if (typeof window !== 'undefined' && window.AMap) return Promise.resolve(window.AMap)
  if (loading) return loading

  const key = readEnvValue(import.meta.env.VITE_AMAP_KEY)
  const securityCode = readEnvValue(import.meta.env.VITE_AMAP_SECURITY_CODE)
  if (!key || !securityCode) {
    return Promise.reject(
      new AppError(
        'AMAP_LOAD',
        '未配置高德 Key：请在 .env.local 中填写 VITE_AMAP_KEY 与 VITE_AMAP_SECURITY_CODE，然后重启 pnpm dev'
      )
    )
  }

  window._AMapSecurityConfig = { securityJsCode: securityCode }

  loading = new Promise<AmapNamespace>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=${PLUGINS}`

    let timer = 0
    const cleanup = () => {
      if (timer) window.clearTimeout(timer)
      script.onload = null
      script.onerror = null
    }

    script.onload = () => {
      cleanup()
      if (window.AMap) {
        resolve(window.AMap)
      } else {
        reject(new AppError('AMAP_LOAD', '地图脚本已加载但未初始化，请检查 Key 与安全密钥'))
      }
    }
    script.onerror = () => {
      cleanup()
      reject(new AppError('AMAP_LOAD', '地图脚本加载失败，请检查网络与域名白名单'))
    }
    timer = window.setTimeout(() => {
      cleanup()
      reject(new AppError('AMAP_LOAD', '地图脚本加载超时，请检查网络与域名白名单'))
    }, TIMEOUT_MS)

    document.head.appendChild(script)
  })

  loading.catch(() => {
    loading = null
  })
  return loading
}
