// components/admin/ui/FormModal.jsx — LevelPro Precision Modal & FormField
import { cloneElement, isValidElement, useEffect, useId, useRef } from "react"
import { X, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { PrimaryButton, SecondaryButton } from "./Buttons"

export function FormModal({
  open: openProp, isOpen: isOpenProp, title, children, onClose, onSave,
  saving = false, saveDisabled = false, saveLabel = "Guardar", cancelLabel = "Cancelar",
  error, maxWidth = "460px", scrollableBody = false, testId,
}) {
  const open = openProp ?? isOpenProp
  const titleId = useId()
  const dialogRef = useRef(null)
  const actionRef = useRef(onClose)
  useEffect(() => { actionRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    dialogRef.current?.focus()
    const h = (e) => {
      if (e.key === "Escape") actionRef.current?.()
      if (e.key !== "Tab") return
      const candidates = [...(dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || [])]
      if (!candidates.length) { e.preventDefault(); dialogRef.current?.focus(); return }
      const first = candidates[0], last = candidates[candidates.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    window.addEventListener("keydown", h)
    return () => { window.removeEventListener("keydown", h); previous?.focus?.() }
  }, [open])

  if (!open) return null

  return (
    <div className="admin-portal-root au-modal__backdrop" onClick={onClose} data-testid={testId || "form-modal"}>
      <div
        className="au-modal"
        style={{
          maxWidth,
          textAlign: "left",
          padding: 0,
          ...(scrollableBody ? { maxHeight: "90vh", display: "flex", flexDirection: "column" } : {}),
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-modal="true"
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E4E4E7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <p id={titleId} style={{ fontSize: 15, fontWeight: 600, color: "#09090B", margin: 0 }}>{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#71717A",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            ...(scrollableBody ? { flex: 1, overflowY: "auto" } : {}),
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#DC2626",
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}
          {children}
        </div>

        {onSave && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #E4E4E7",
              background: "#FAFAFA",
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              flexShrink: 0,
              borderRadius: "0 0 14px 14px",
            }}
          >
            <SecondaryButton onClick={onClose}>{cancelLabel}</SecondaryButton>
            <PrimaryButton onClick={onSave} loading={saving} disabled={saving || saveDisabled}>
              {saving ? "Guardando..." : saveLabel}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  )
}

// Estilo de input LevelPro Precision — SIEMPRE claro (#FFFFFF) con borde hairline #E4E4E7
// eslint-disable-next-line react-refresh/only-export-components
export const formInputStyle = {
  width: "100%",
  padding: "9px 12px",
  background: "#FFFFFF",
  border: "1px solid #E4E4E7",
  borderRadius: "8px",
  color: "#09090B",
  fontSize: "13px",
  outline: "none",
}

const APPEARANCE_STYLES = {
  success: { borderColor: "#0F7A38", messageColor: "#0F7A38", Icon: CheckCircle2 },
  warning: { borderColor: "#B45309", messageColor: "#B45309", Icon: AlertTriangle },
  danger: { borderColor: "#DC2626", messageColor: "#DC2626", Icon: XCircle },
  none: null,
}

export function FormField({ label, required = false, appearance = "none", children, id, description, error }) {
  const generatedId = useId()
  const resolvedAppearance = error ? "danger" : appearance
  const meta = APPEARANCE_STYLES[resolvedAppearance]
  const directControl = isValidElement(children)
    && typeof children.type === "string"
    && ["input", "select", "textarea"].includes(children.type)
  const controlId = directControl ? (children.props.id || id || generatedId) : undefined
  const hintId = `${generatedId}-hint`
  const labelStyle = {
    display: "block",
    fontSize: "12.5px",
    fontWeight: 500,
    color: "#52525B",
    marginBottom: "6px",
  }

  const rendered = directControl
    ? cloneElement(children, {
        id: controlId,
        ...(description || error ? {
          "aria-describedby": [children.props["aria-describedby"], hintId].filter(Boolean).join(" "),
        } : {}),
        ...(resolvedAppearance === "danger" ? { "aria-invalid": true } : {}),
        style: {
          ...children.props.style,
          ...(meta ? { borderColor: meta.borderColor } : {}),
        },
      })
    : children

  const MsgIcon = meta?.Icon
  const messageText = error || description

  return (
    <div className="au-formfield">
      {label && (
        directControl ? (
          <label htmlFor={controlId} style={labelStyle}>
            {label}{required && <span style={{ color: "#DC2626", marginLeft: 3 }}>*</span>}
          </label>
        ) : (
          <span style={labelStyle}>
            {label}{required && <span style={{ color: "#DC2626", marginLeft: 3 }}>*</span>}
          </span>
        )
      )}
      {rendered}
      {messageText && (
        <p
          id={hintId}
          role={resolvedAppearance === "danger" ? "alert" : undefined}
          className={resolvedAppearance === "danger" ? "au-formfield__error" : "au-formfield__help"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            margin: "5px 0 0",
            fontSize: 12,
            color: meta ? meta.messageColor : "#71717A",
          }}
        >
          {MsgIcon && <MsgIcon size={13} strokeWidth={2} aria-hidden="true" />}
          <span>{messageText}</span>
        </p>
      )}
    </div>
  )
}
