// components/admin/ui/ConfirmationModal.jsx — LevelPro Precision ConfirmationModal
import { useEffect, useId, useRef } from "react"
import { AlertTriangle, X } from "lucide-react"
import { PrimaryButton, SecondaryButton, DangerButton } from "./Buttons"

export function ConfirmationModal({
  open, title = "¿Confirmar acción?", description, warningNote,
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
    const h = (e) => {
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
    <div className="admin-portal-root au-modal__backdrop" onClick={onCancel} data-testid={testId || "confirm-modal"}>
      <div
        className="au-modal"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ padding: 22 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <p id={titleId} className="au-modal__title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#09090B" }}>
            {title}
          </p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer", padding: 2 }}
          >
            <X size={15} />
          </button>
        </div>

        {description && (
          <p className="au-modal__desc" style={{ fontSize: 13, color: "#52525B", lineHeight: 1.5, marginBottom: warningNote ? 12 : 18 }}>
            {description}
          </p>
        )}

        {warningNote && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
              fontSize: 12.5,
              lineHeight: 1.45,
              marginBottom: 18,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <span>{warningNote}</span>
          </div>
        )}

        <div className="au-modal__actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <SecondaryButton onClick={onCancel} testId="confirm-cancel">{cancelLabel}</SecondaryButton>
          <Confirm onClick={onConfirm} loading={loading} disabled={loading} testId="confirm-accept">
            {loading ? "Procesando…" : confirmLabel}
          </Confirm>
        </div>
      </div>
    </div>
  )
}
