// components/admin/ui/ConfirmationModal.jsx
import { useEffect, useId, useRef } from "react"
import { PrimaryButton, SecondaryButton, DangerButton } from "./Buttons"

export function ConfirmationModal({
  open, title = "¿Confirmar acción?", description,
  confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  danger = false, loading = false, onConfirm, onCancel, testId,
}) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const actionRef = useRef(onCancel)
  useEffect(() => { actionRef.current = onCancel }, [onCancel])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    dialogRef.current?.focus()
    const h = e => {
      if (e.key === "Escape") actionRef.current?.()
      if (e.key !== "Tab") return
      const buttons = [...(dialogRef.current?.querySelectorAll("button:not([disabled])") || [])]
      if (!buttons.length) { e.preventDefault(); return }
      if (e.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialogRef.current)) {
        e.preventDefault(); buttons[buttons.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        e.preventDefault(); buttons[0].focus()
      }
    }
    window.addEventListener("keydown", h)
    return () => { window.removeEventListener("keydown", h); previous?.focus?.() }
  }, [open])

  if (!open) return null
  const Confirm = danger ? DangerButton : PrimaryButton
  return (
    <div className="au-modal__backdrop" onClick={onCancel} data-testid={testId || "confirm-modal"}>
      <div className="au-modal" ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <p id={titleId} className="au-modal__title">{title}</p>
        {description && <p className="au-modal__desc">{description}</p>}
        <div className="au-modal__actions">
          <SecondaryButton onClick={onCancel} testId="confirm-cancel">{cancelLabel}</SecondaryButton>
          <Confirm onClick={onConfirm} disabled={loading} testId="confirm-accept">
            {loading ? "Procesando…" : confirmLabel}
          </Confirm>
        </div>
      </div>
    </div>
  )
}
