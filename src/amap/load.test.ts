import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasAmapKey } from './load'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('hasAmapKey', () => {
  it('rejects placeholder values from the example file', () => {
    vi.stubEnv('VITE_AMAP_KEY', 'your-amap-js-api-key')
    vi.stubEnv('VITE_AMAP_SECURITY_CODE', 'your-amap-security-code')
    expect(hasAmapKey()).toBe(false)
  })

  it('rejects missing values', () => {
    vi.stubEnv('VITE_AMAP_KEY', '')
    vi.stubEnv('VITE_AMAP_SECURITY_CODE', '')
    expect(hasAmapKey()).toBe(false)
  })

  it('accepts configured values', () => {
    vi.stubEnv('VITE_AMAP_KEY', '0123456789abcdef0123456789abcdef')
    vi.stubEnv('VITE_AMAP_SECURITY_CODE', 'abcdef0123456789abcdef0123456789')
    expect(hasAmapKey()).toBe(true)
  })
})
