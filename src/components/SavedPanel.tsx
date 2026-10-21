import { useEffect, useRef } from 'react'
import type { SavedRoute } from '../core/favorites'

interface SavedPanelProps {
  open: boolean
  routes: SavedRoute[]
  onClose: () => void
  onLoad: (id: number) => void
  onDelete: (id: number) => void
}

export default function SavedPanel({ open, routes, onClose, onLoad, onDelete }: SavedPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="saved-dialog"
      aria-labelledby="saved-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="saved-card">
        <div className="saved-head">
          <h2 id="saved-dialog-title">已收藏路线</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭收藏">
            ✕
          </button>
        </div>

        {routes.length === 0 ? (
          <p className="status-text">暂无收藏。规划好路线后点击「收藏路线」保存。</p>
        ) : (
          <ul className="saved-list">
            {routes.map((route) => (
              <li key={route.id}>
                <button type="button" className="saved-item" onClick={() => onLoad(route.id)}>
                  <span className="saved-name">{route.name}</span>
                  <span className="saved-meta">
                    {route.city || '未选城市'} · {route.points.length} 个点 · {route.savedAt}
                  </span>
                </button>
                <button
                  type="button"
                  className="saved-delete"
                  aria-label={`删除收藏 ${route.name}`}
                  onClick={() => onDelete(route.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  )
}
