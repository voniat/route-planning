import type { Point } from '../core/points'
import type { StepView } from '../amap/route'
import type { RouteMode, RoutePlansState } from '../hooks/useRoutePlans'

interface RoutePanelProps {
  points: Point[]
  activeSegment: number
  mode: RouteMode
  state: RoutePlansState
  onSegmentChange: (index: number) => void
  onModeChange: (mode: RouteMode) => void
  onSelectPlan: (index: number) => void
  onRetry: () => void
  onBack: () => void
}

function stepMeta(step: StepView): string {
  const parts: string[] = []
  if (step.mode === 'WALKING' && step.distanceM) parts.push(`${step.distanceM}m`)
  if (step.stations) parts.push(`${step.stations}站`)
  if (step.durationMin) parts.push(`${step.durationMin}分钟`)
  return parts.join(' · ')
}

function stepIcon(step: StepView): string {
  if (step.mode === 'WALKING') return '🚶'
  if (step.transitType?.includes('地铁')) return '🚇'
  if (step.transitType?.includes('火车')) return '🚄'
  return '🚌'
}

export default function RoutePanel({
  points,
  activeSegment,
  mode,
  state,
  onSegmentChange,
  onModeChange,
  onSelectPlan,
  onRetry,
  onBack
}: RoutePanelProps) {
  const plan = state.plans[state.planIndex] ?? state.plans[0]

  return (
    <section className="route-panel" aria-label="交通路线">
      <div className="route-panel-head">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← 返回
        </button>
        <h2>交通路线</h2>
      </div>

      <div className="segment-tabs" role="tablist" aria-label="路段">
        {points.slice(0, -1).map((point, index) => {
          const destination = points[index + 1]
          if (!destination) return null
          return (
            <button
              key={`${point.id}-${destination.id}`}
              type="button"
              role="tab"
              aria-selected={index === activeSegment}
              className={index === activeSegment ? 'segment-tab active' : 'segment-tab'}
              onClick={() => onSegmentChange(index)}
            >
              {point.title} → {destination.title}
            </button>
          )
        })}
      </div>

      <div className="mode-tabs" role="tablist" aria-label="出行方式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'transit'}
          className={mode === 'transit' ? 'mode-tab active' : 'mode-tab'}
          onClick={() => onModeChange('transit')}
        >
          公交/地铁
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'walking'}
          className={mode === 'walking' ? 'mode-tab active' : 'mode-tab'}
          onClick={() => onModeChange('walking')}
        >
          步行
        </button>
      </div>

      {state.status === 'loading' && (
        <p className="status-text" role="status">
          正在规划路线…
        </p>
      )}

      {state.status === 'error' && (
        <div className="status-card">
          <p>{state.error}</p>
          <button type="button" className="btn ghost" onClick={onRetry}>
            重试
          </button>
        </div>
      )}

      {state.status === 'ready' && mode === 'transit' && plan && (
        <>
          {state.plans.length > 1 && (
            <div className="plan-tabs" role="tablist" aria-label="公交方案">
              {state.plans.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={index === state.planIndex}
                  className={index === state.planIndex ? 'plan-tab active' : 'plan-tab'}
                  onClick={() => onSelectPlan(index)}
                >
                  方案{index + 1}
                  {item.cost !== null ? ` ¥${item.cost}` : ''}
                </button>
              ))}
            </div>
          )}

          <div className="route-summary">
            <span>{plan.distanceKm} km</span>
            <span>约 {plan.durationMin} 分钟</span>
            {plan.cost !== null && <span>¥{plan.cost}</span>}
          </div>

          <ol className="step-list" aria-label="路线步骤">
            {plan.steps.map((step) => {
              const meta = stepMeta(step)
              return (
                <li key={step.key} className="step">
                  <span className="step-icon" aria-hidden="true">
                    {stepIcon(step)}
                  </span>
                  <span className="step-body">
                    <span className="step-title">{step.title}</span>
                    {step.transitType && <span className="step-badge">{step.transitType}</span>}
                    {step.fromStation && step.toStation && (
                      <span className="step-stations">
                        {step.fromStation} → {step.toStation}
                      </span>
                    )}
                    {meta && <span className="step-meta">{meta}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        </>
      )}

      {state.status === 'ready' && mode === 'transit' && !plan && (
        <p className="status-text">未找到公交方案</p>
      )}

      {state.status === 'ready' && mode === 'walking' && state.walking && (
        <div className="walk-summary">
          <p>
            步行约 {state.walking.durationMin} 分钟，{state.walking.distanceKm} 公里
          </p>
          <p className="muted">地图上已标出步行路线。</p>
        </div>
      )}

      {state.status === 'ready' && mode === 'walking' && !state.walking && (
        <p className="status-text">未找到步行路线</p>
      )}
    </section>
  )
}
