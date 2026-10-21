import { useEffect, useRef } from 'react'

interface TextDialogProps {
  open: boolean
  title: string
  text: string
  onClose: () => void
}

export default function TextDialog({ open, title, text, onClose }: TextDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      areaRef.current?.focus()
      areaRef.current?.select()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="text-dialog"
      aria-labelledby="text-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="text-card">
        <h2 id="text-dialog-title">{title}</h2>
        <textarea
          ref={areaRef}
          readOnly
          value={text}
          rows={Math.min(12, Math.max(4, text.split('\n').length))}
        />
        <div className="dialog-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </dialog>
  )
}
