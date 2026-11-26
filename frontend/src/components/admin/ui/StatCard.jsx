// components/admin/ui/StatCard.jsx
import { Link } from "react-router-dom"
import { TrendingUp, TrendingDown } from "lucide-react"

export function MetricBadge({ delta, className = "" }) {
  if (delta === undefined || delta === null) return null
  const pos = delta >= 0
  return (
    <span className={`au-lp__delta ${pos ? "au-lp__delta--pos" : "au-lp__delta--neg"} ${className}`} data-testid="metric-badge">
      {pos ? <TrendingUp size={13} strokeWidth={2.2} /> : <TrendingDown size={13} strokeWidth={2.2} />}
      {Math.abs(delta)}{typeof delta === "number" ? "%" : ""}
    </span>
  )
}

/**
 * StatCard — Tarjeta KPI calibrada bajo estándar LevelPro Precision (Nimbus × Lumin).
 * Conserva compatibilidad retroactiva de todos los props legacy ("variant", "icon", "Icon", "title", "description").
 */
export function StatCard({
  Icon, icon, label, title, value, sub, description, delta, deltaSuffix = "%", badge,
  variant = "light", to, onClick, loading = false, interactive, testId,
}) {
  if (loading) {
    return (
      <div
        className="au-lp au-skel"
        style={{ height: 118, background: undefined }}
        data-testid={testId ? `${testId}-loading` : undefined}
      />
    )
  }

  const lbl = label || title
  const s = sub || description
  const IconComp = Icon || (typeof icon === "function" ? icon : null)
  const renderedIcon = IconComp ? <IconComp size={16} strokeWidth={1.75} /> : (icon || null)

  const isInteractive = interactive ?? Boolean(to || onClick)
  const normalizedVariant = variant === "compact" ? "compact" : "light"
  const cls = `au-lp au-lp--${normalizedVariant} ${isInteractive ? "au-lp--interactive" : ""}`.trim()
  const hasFoot = s != null || delta != null || badge

  const inner = (
    <>
      <div className="au-lp__top">
        {lbl && <span className="au-lp__tag">{lbl}</span>}
        {renderedIcon && <span className="au-lp__icon">{renderedIcon}</span>}
      </div>
      <div className="au-lp__value">{value}</div>
      {hasFoot && (
        <div className="au-lp__foot">
          {s != null && <span className="au-lp__pill">{s}</span>}
          {delta != null && (
            <span className={`au-lp__delta ${delta >= 0 ? "au-lp__delta--pos" : "au-lp__delta--neg"}`}>
              {delta >= 0 ? <TrendingUp size={12} strokeWidth={2.2} /> : <TrendingDown size={12} strokeWidth={2.2} />}
              {Math.abs(delta)}{deltaSuffix}
            </span>
          )}
          {badge}
        </div>
      )}
    </>
  )

  if (to) return <Link to={to} className={cls} data-testid={testId}>{inner}</Link>
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        data-testid={testId}
        style={{ width: "100%", textAlign: "left", cursor: "pointer", font: "inherit" }}
      >
        {inner}
      </button>
    )
  }
  return <div className={cls} data-testid={testId}>{inner}</div>
}

export function SummaryStats({ items = [], loading = false, testId }) {
  if (!items.length && !loading) return null
  return (
    <div className="lp-summary-strip" data-testid={testId || "summary-stats"}>
      {loading
        ? [0, 1, 2, 3].map((idx) => <StatCard key={idx} loading />)
        : items.map((item, idx) => <StatCard key={item.key || item.label || idx} {...item} />)}
    </div>
  )
}
