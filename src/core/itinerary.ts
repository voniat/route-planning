import type { Point } from './points'

export function buildItineraryText(points: readonly Point[], city: string): string {
  const header = city
    ? `【旅行路线】${city} · ${points.length}个地点`
    : `【旅行路线】${points.length}个地点`
  return [header, ...points.map((point, index) => `${index + 1}. ${point.title}`)].join('\n')
}
