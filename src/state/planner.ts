import { DEFAULT_CITY, type City } from '../core/cities'
import { MAX_POINTS, type Point } from '../core/points'

export interface PlannerState {
  city: City
  points: Point[]
}

export type PlannerAction =
  | { type: 'set-city'; city: City }
  | { type: 'add-point'; point: Point }
  | { type: 'insert-point'; point: Point; index: number }
  | { type: 'remove-point'; id: string }
  | { type: 'move-point'; from: number; to: number }
  | { type: 'replace-points'; points: Point[]; city?: City }
  | { type: 'clear' }

export const initialPlannerState: PlannerState = {
  city: DEFAULT_CITY,
  points: []
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'set-city':
      return { ...state, city: action.city }
    case 'add-point':
      if (state.points.length >= MAX_POINTS) return state
      return { ...state, points: [...state.points, action.point] }
    case 'insert-point': {
      if (state.points.length >= MAX_POINTS) return state
      const points = [...state.points]
      const index = Math.max(0, Math.min(action.index, points.length))
      points.splice(index, 0, action.point)
      return { ...state, points }
    }
    case 'remove-point':
      return { ...state, points: state.points.filter((point) => point.id !== action.id) }
    case 'move-point': {
      if (action.from === action.to) return state
      const points = [...state.points]
      const [item] = points.splice(action.from, 1)
      if (!item) return state
      points.splice(action.to, 0, item)
      return { ...state, points }
    }
    case 'replace-points':
      return { city: action.city ?? state.city, points: action.points }
    case 'clear':
      return { ...state, points: [] }
    default:
      return state
  }
}
