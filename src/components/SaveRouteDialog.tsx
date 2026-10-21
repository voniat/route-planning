import { useEffect, useRef, useState } from 'react'

interface SaveRouteDialogProps {
  open: boolean
  defaultName: string
  onCancel: () => void
  onSave: (name: string) => void
}

export default function SaveRouteDialog({
  open,
  defaultName,
  onCancel,
  onSave
}: SaveRouteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(defaultName)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    setName(defaultName)
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open, defaultName])

  function submit(): void {
    onSave(name.trim() || defaultName)
  }

  return (
    <dialog
      ref={dialogRef}
      className="save-dialog"
      aria-labelledby="save-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="save-card">
        <h2 id="save-dialog-title">收藏路线</h2>
        <label className="save-label" htmlFor="route-name">
          路线名称
        </label>
        <input
          id="route-name"
          ref={inputRef}
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn primary" onClick={submit}>
            保存
          </button>
        </div>
      </div>
    </dialog>
  )
}
