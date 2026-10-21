export type AppErrorCode = 'AMAP_LOAD' | 'GEO' | 'SEARCH' | 'ROUTE' | 'WEATHER' | 'STORAGE'

export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}
