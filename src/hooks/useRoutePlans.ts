import { useCallback, useEffect, useRef, useState } from 'react'
import { loadAmap } from '../amap/load'
import {
  getTransitPlans,
  getWalkingPlan,
  type PlanView,
  type WalkingView
} from '../amap/route'
import type { City } from '../core/cities'
import type { Point } from '../core/points'

export type RouteMode = 'transit' | 'walking'

export interface RoutePlansState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  plans: PlanView[]
  walking: WalkingView | null
  planIndex: number
  error: string
}

const IDLE_STATE: RoutePlansState = {
  status: 'idle',
  plans: [],
  walking: null,
  planIndex: 0,
  error: ''
}

interface RouteResult {
  plans: PlanView[]
  walking: WalkingView | null
}

export function useRoutePlans(
  points: Point[],
  city: City,
  open: boolean,
  segmentIndex: number,
  mode: RouteMode
) {
  const [state, setState] = useState<RoutePlansState>(IDLE_STATE)
  const [attempt, setAttempt] = useState(0)
  const cache = useRef(new Map<string, RouteResult>())
  const requestId = useRef(0)

  const segment = points[segmentIndex]
  const next = points[segmentIndex + 1]
  const key =
    open && segment && next
      ? `${segmentIndex}|${mode}|${city.name}|${segment.lng},${segment.lat}|${next.lng},${next.lat}`
      : ''

  useEffect(() => {
    const id = ++requestId.current
    if (!open || !key || !segment || !next) {
      setState(IDLE_STATE)
      return
    }

    const cached = cache.current.get(key)
    if (cached) {
      setState({ status: 'ready', plans: cached.plans, walking: cached.walking, planIndex: 0, error: '' })
      return
    }

    setState({ status: 'loading', plans: [], walking: null, planIndex: 0, error: '' })
    const origin = { lng: segment.lng, lat: segment.lat }
    const destination = { lng: next.lng, lat: next.lat }

    loadAmap()
      .then((amap): Promise<RouteResult> => {
        if (mode === 'transit') {
          return getTransitPlans(amap, origin, destination, city.name).then((plans) => ({
            plans,
            walking: null
          }))
        }
        return getWalkingPlan(amap, origin, destination).then((walking) => ({
          plans: [],
          walking
        }))
      })
      .then((result: RouteResult) => {
        if (requestId.current !== id) return
        cache.current.set(key, result)
        setState({
          status: 'ready',
          plans: result.plans,
          walking: result.walking,
          planIndex: 0,
          error: ''
        })
      })
      .catch((error: unknown) => {
        if (requestId.current !== id) return
        setState({
          status: 'error',
          plans: [],
          walking: null,
          planIndex: 0,
          error: error instanceof Error ? error.message : '路线获取失败'
        })
      })

    return () => {
      requestId.current += 1
    }
  }, [open, key, mode, attempt, city.name, segment, next])

  const selectPlan = useCallback((index: number) => {
    setState((current) =>
      index >= 0 && index < current.plans.length ? { ...current, planIndex: index } : current
    )
  }, [])

  const retry = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

  return { ...state, selectPlan, retry }
}
