// components/legal/AcceptCheckbox.jsx — Checkbox de aceptación legal reutilizable
import { Check } from "lucide-react"

export default function AcceptCheckbox({ checked, onChange, testId, children }) {
  return (
    <label
      data-testid={testId}
      onClick={(e) => {
        // Evita togglear al hacer clic en un enlace interno
        if (e.target.closest("a")) return
        onChange(!checked)
      }}
      style={{
        display: "flex", gap: "11px", alignItems: "flex-start",
        cursor: "pointer", userSelect: "none",
      }}>
      <span
        role="checkbox"
        aria-checked={checked}
        style={{
          flexShrink: 0, width: "20px", height: "20px", marginTop: "1px",
          borderRadius: "6px",
          background: checked ? "var(--accent)" : "rgba(255,255,255,0.04)",
          border: checked ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#000", transition: "background 160ms var(--ease), border-color 160ms var(--ease)",
        }}>
        {checked && <Check size={13} strokeWidth={3.5} />}
      </span>
      <span style={{ fontSize: "13px", lineHeight: 1.55, color: "var(--text-2)" }}>
        {children}
      </span>
    </label>
  )
}
