// components/admin/ui/Panels.jsx
import { EmptyState } from "./EmptyState"

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
