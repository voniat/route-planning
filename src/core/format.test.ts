import { describe, expect, it } from 'vitest'
import { formatDistance, formatDuration } from './format'

describe('formatDistance', () => {
  it('uses meters below one kilometer', () => {
    expect(formatDistance(0.45)).toBe('450m')
  })

  it('uses one decimal for kilometers', () => {
    expect(formatDistance(12.34)).toBe('12.3km')
  })

  it('falls back for invalid input', () => {
    expect(formatDistance(Number.NaN)).toBe('--')
  })
})

describe('formatDuration', () => {
  it('formats minutes', () => {
    expect(formatDuration(25)).toBe('25 分钟')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(95)).toBe('1 小时 35 分钟')
  })

  it('formats whole hours', () => {
    expect(formatDuration(120)).toBe('2 小时')
  })

  it('falls back for invalid input', () => {
    expect(formatDuration(0)).toBe('--')
  })
})
