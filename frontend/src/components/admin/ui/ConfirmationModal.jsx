// components/admin/ui/ConfirmationModal.jsx
import { useEffect } from "react"
import { PrimaryButton, SecondaryButton, DangerButton } from "./Buttons"

export function ConfirmationModal({
  open, title = "¿Confirmar acción?", description,
  confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  danger = false, loading = false, onConfirm, onCancel, testId,
}) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === "Escape" && onCancel?.()
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onCancel])

  if (!open) return null
  const Confirm = danger ? DangerButton : PrimaryButton
  return (
    <div className="au-modal__backdrop" onClick={onCancel} data-testid={testId || "confirm-modal"}>
      <div className="au-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <p className="au-modal__title">{title}</p>
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
