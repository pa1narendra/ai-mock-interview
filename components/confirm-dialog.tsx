"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: "primary" | "danger"
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

// Modal confirmation for actions that are easy to trigger by accident
// (start, end, create). Built on the native <dialog>, so Escape, focus
// trapping and the backdrop come from the browser. Cancel is focused first,
// so a stray Enter or Space never confirms.
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-6 sm:p-7">
        <div className="flex items-start gap-3">
          {icon && (
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                tone === "danger" ? "bg-destructive/15 text-destructive" : "bg-surface-raised text-foreground"
              )}
            >
              {icon}
            </span>
          )}
          <div className="space-y-1.5">
            <h3 id="confirm-dialog-title" className="text-lg">{title}</h3>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2 max-sm:flex-col-reverse">
          <button type="button" className="btn-outline" onClick={onCancel} ref={cancelRef}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn-danger" : "btn-highlight"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default ConfirmDialog
