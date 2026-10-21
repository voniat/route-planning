import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Point } from '../core/points'

interface PointListProps {
  points: Point[]
  selectedId?: string | null
  onRemove: (id: string) => void
  onMove: (from: number, to: number) => void
}

interface DragState {
  from: number
  startY: number
  itemHeight: number
  pointerId: number
  handle: HTMLButtonElement
}

export default function PointList({ points, selectedId, onRemove, onMove }: PointListProps) {
  const pointsRef = useRef(points)
  pointsRef.current = points
  const dragRef = useRef<DragState | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (!selectedId) return
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-point-id]')
    if (!rows) return
    const row = Array.from(rows).find((item) => item.dataset.pointId === selectedId)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  function move(from: number, to: number): void {
    if (to < 0 || to >= pointsRef.current.length || from === to) return
    onMove(from, to)
    setAnnouncement(`已移动到第 ${to + 1} 位`)
  }

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    index: number,
    id: string
  ): void {
    const row = event.currentTarget.closest<HTMLElement>('.point-row')
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      from: index,
      startY: event.clientY,
      itemHeight: row?.getBoundingClientRect().height || 56,
      pointerId: event.pointerId,
      handle: event.currentTarget
    }
    setDraggingId(id)
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current
    if (!drag) return
    const steps = Math.trunc((event.clientY - drag.startY) / drag.itemHeight)
    if (steps === 0) return
    const target = Math.max(0, Math.min(pointsRef.current.length - 1, drag.from + steps))
    if (target === drag.from) return
    onMove(drag.from, target)
    setAnnouncement(`已移动到第 ${target + 1} 位`)
    drag.from = target
    drag.startY = event.clientY
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current
    if (drag) {
      try {
        drag.handle.releasePointerCapture(drag.pointerId)
      } catch {
        // 指针已经释放时忽略。
      }
    }
    dragRef.current = null
    setDraggingId(null)
    if (event.type === 'pointerup') setAnnouncement('排序完成')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(index, index - 1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(index, index + 1)
    }
  }

  return (
    <div className="point-list-wrap">
      <ol ref={listRef} className="point-list" aria-label="途经点顺序">
        {points.map((point, index) => {
          const isStart = index === 0
          const isEnd = index === points.length - 1
          return (
            <li
              key={point.id}
              data-point-id={point.id}
              aria-current={selectedId === point.id ? 'true' : undefined}
              className={
                draggingId === point.id
                  ? 'point-row dragging'
                  : selectedId === point.id
                    ? 'point-row selected'
                    : 'point-row'
              }
            >
              <button
                type="button"
                className="drag-handle"
                aria-label={`拖动排序：${point.title}，也可使用上下方向键`}
                onPointerDown={(event) => handlePointerDown(event, index, point.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={() => {
                  dragRef.current = null
                  setDraggingId(null)
                }}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                ⠿
              </button>
              <span
                className={
                  isStart ? 'summary-index start' : isEnd ? 'summary-index end' : 'summary-index'
                }
              >
                {isStart ? '起' : isEnd ? '终' : index + 1}
              </span>
              <span className="point-main">
                <span className="point-title">{point.title}</span>
                {point.address && <span className="point-address">{point.address}</span>}
              </span>
              <button
                type="button"
                className="point-delete"
                aria-label={`删除 ${point.title}`}
                onClick={() => onRemove(point.id)}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
