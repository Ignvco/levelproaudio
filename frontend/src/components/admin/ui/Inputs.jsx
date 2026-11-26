// components/admin/ui/Inputs.jsx
import { Search, X } from "lucide-react"

export function SearchInput({ value, onChange, placeholder = "Buscar...", testId }) {
  return (
    <div className="au-search" style={{ position: "relative" }}>
      <Search size={15} strokeWidth={1.75} />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        data-testid={testId || "search-input"}
        style={{ paddingRight: value ? 30 : 12 }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.("")}
          aria-label="Limpiar búsqueda"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            padding: 2,
            color: "var(--lp-text-muted, #71717A)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({ value, onChange, options = [], ariaLabel, testId }) {
  return (
    <select
      className="au-select"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function FilterChipBar({ chips = [], onClearAll, testId }) {
  if (!chips.length) return null
  return (
    <div className="lp-chips-bar" data-testid={testId || "filter-chip-bar"}>
      <span style={{ fontSize: 12, color: "var(--lp-text-muted, #71717A)", fontWeight: 500 }}>
        Filtros activos:
      </span>
      {chips.map((c) => (
        <span key={c.key} className="lp-chip">
          <span>{c.label}</span>
          {c.onRemove && (
            <button
              type="button"
              onClick={c.onRemove}
              aria-label={`Quitar filtro ${c.label}`}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                color: "var(--lp-text-muted, #71717A)",
                cursor: "pointer",
              }}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          style={{
            background: "transparent",
            border: "none",
            padding: "2px 6px",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--lp-accent-ink, #0F7A38)",
            cursor: "pointer",
          }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

export function SwitchToggle({ checked = false, onChange, disabled = false, label, id, testId }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => !disabled && onChange?.(!checked)}
      className={`lp-switch ${checked ? "is-checked" : ""}`}
    >
      <span className="lp-switch__thumb" aria-hidden="true" />
    </button>
  )
}
