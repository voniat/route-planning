import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
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
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="confirm-card">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="btn primary" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </dialog>
  )
}
