// components/admin/ui/FormModal.jsx
//
// Wrapper genérico para modales de crear/editar. Antes cada página de admin
// reimplementaba su propio backdrop + panel + header + footer desde cero
// (12 páginas con el mismo bloque de "position: fixed" copiado y pegado).
// Ahora el layout vive en un solo lugar; el contenido del formulario sigue
// siendo específico de cada página (children).
import { useEffect } from "react"
import { PrimaryButton, SecondaryButton } from "./Buttons"

export function FormModal({
  open, title, children, onClose, onSave,
  saving = false, saveLabel = "Guardar", cancelLabel = "Cancelar",
  error, maxWidth = "440px", scrollableBody = false, testId,
}) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === "Escape" && onClose?.()
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="au-modal__backdrop" onClick={onClose} data-testid={testId || "form-modal"}>
      <div
        className="au-modal"
        style={{
          maxWidth, textAlign: "left", padding: 0,
          ...(scrollableBody ? { maxHeight: "90vh", display: "flex", flexDirection: "column" } : {}),
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0 }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>{title}</p>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none",
            border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "22px" }}>×</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px",
          ...(scrollableBody ? { flex: 1, overflowY: "auto" } : {}) }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>
              {error}
            </div>
          )}
          {children}
        </div>

        {onSave && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
            display: "flex", gap: "10px", justifyContent: "flex-end", flexShrink: 0 }}>
            <SecondaryButton onClick={onClose}>{cancelLabel}</SecondaryButton>
            <PrimaryButton onClick={onSave} disabled={saving}>
              {saving ? "Guardando..." : saveLabel}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  )
}

// Estilo de input consistente, para que los formularios dentro de FormModal
// no tengan que redefinir esto en cada página.
export const formInputStyle = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
}

export function FormField({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
        color: "var(--text-2)", marginBottom: "7px" }}>{label}</label>
      {children}
    </div>
  )
}
