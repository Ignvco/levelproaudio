// components/admin/ui/Panels.jsx
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import { EmptyState } from "./EmptyState"
import { PrimaryButton, SecondaryButton } from "./Buttons"

export function SectionCard({ title, description, action, children, padding = true, className, testId }) {
  return (
    <div className={`au-card ${padding ? "au-panel" : ""} ${className || ""}`.trim()} data-testid={testId}>
      {(title || action) && (
        <div className="au-panel__head">
          <div>
            {title && <h2 className="au-panel__title">{title}</h2>}
            {description && <p className="au-panel__desc">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function ChartLegend({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="au-legend">
      {items.map((it, i) => (
        <span key={i} className="au-legend__item">
          <span className="au-legend__dot" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

export function ChartCard({
  title, description, action, legend, period,
  loading = false, isEmpty = false, emptyTitle, emptyDesc, emptyIcon,
  height = 260, children, testId,
}) {
  return (
    <div className="au-card au-panel" data-testid={testId}>
      <div className="au-panel__head">
        <div>
          {title && <h2 className="au-panel__title">{title}</h2>}
          {description && <p className="au-panel__desc">{description}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {legend && <ChartLegend items={legend} />}
          {period}
          {action}
        </div>
      </div>
      {loading
        ? <div className="au-skel" style={{ height }} />
        : isEmpty
          ? <EmptyState Icon={emptyIcon} title={emptyTitle || "Sin datos todavía"} description={emptyDesc} />
          : <div style={{ width: "100%" }}>{children}</div>}
    </div>
  )
}

const CALLOUT_ICONS = {
  neutral: Info,
  primary: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
}

export function CalloutCard({ tone = "neutral", title, description, action, onClose, testId, children }) {
  const Icon = CALLOUT_ICONS[tone] || Info
  return (
    <div className={`lp-callout lp-callout--${tone}`} data-testid={testId} role={tone === "danger" ? "alert" : "status"}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
        <Icon size={17} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          {title && <p style={{ fontWeight: 600, fontSize: 13.5, margin: 0 }}>{title}</p>}
          {description && <p style={{ fontSize: 12.5, margin: title ? "3px 0 0" : 0, opacity: 0.92, lineHeight: 1.45 }}>{description}</p>}
          {children}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {action}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            style={{ background: "transparent", border: "none", padding: 4, color: "inherit", cursor: "pointer" }}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

export const AlertBanner = CalloutCard

export function AdminLayoutGrid({ layout = "asym", children, className = "", style }) {
  const cls = layout === "asym"
    ? `lp-form-layout ${className}`.trim()
    : layout === "two"
      ? `au-grid-2 ${className}`.trim()
      : layout === "three"
        ? `au-grid-3 ${className}`.trim()
        : `au-stack ${className}`.trim()
  return <div className={cls} style={style}>{children}</div>
}

export function UnsavedChangesBar({
  dirty = false,
  message = "Tenés cambios sin guardar",
  saving = false,
  onDiscard,
  onSave,
  saveLabel = "Guardar cambios",
  discardLabel = "Descartar",
  testId = "unsaved-changes-bar",
}) {
  if (!dirty) return null
  return (
    <div className="lp-unsaved-bar" data-testid={testId} role="region" aria-label="Cambios pendientes de guardado">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: "#1AFF6E", flexShrink: 0 }} aria-hidden="true" />
        <span>{message}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {onDiscard && (
          <SecondaryButton size="sm" onClick={onDiscard} disabled={saving} testId="unsaved-discard">
            {discardLabel}
          </SecondaryButton>
        )}
        {onSave && (
          <PrimaryButton
            size="sm"
            onClick={onSave}
            loading={saving}
            testId="unsaved-save"
            style={{ background: "#1AFF6E", color: "#09090B", borderColor: "#1AFF6E" }}
          >
            {saving ? "Guardando..." : saveLabel}
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}
