// components/admin/ui/StatCard.jsx
import { Link } from "react-router-dom"
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react"

export function MetricBadge({ delta, className = "" }) {
  if (delta === undefined || delta === null) return null
  const pos = delta >= 0
  return (
    <span className={`au-metric ${pos ? "au-metric--pos" : "au-metric--neg"} ${className}`} data-testid="metric-badge">
      {pos ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
      {Math.abs(delta)}%
    </span>
  )
}

export function StatCard({
  Icon, label, value, sub, delta, badge,
  variant = "default", action, to, onClick, loading = false,
  interactive, testId,
}) {
  if (loading) return <div className="au-card au-skel" style={{ height: 148 }} data-testid={testId ? `${testId}-loading` : undefined} />

  const isInteractive = interactive ?? Boolean(to || onClick)
  const cls = `au-card au-stat au-stat--${variant} ${isInteractive ? "au-card--interactive" : ""}`

  const inner = (
    <>
      <div className="au-stat__top">
        {Icon && <span className="au-stat__icon"><Icon size={variant === "compact" ? 18 : 20} strokeWidth={2} /></span>}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MetricBadge delta={delta} />
          {badge}
          {isInteractive && <ArrowUpRight size={16} style={{ color: "var(--admin-text-muted)" }} />}
        </div>
      </div>
      <div className="au-stat__body">
        <p className="au-stat__label">{label}</p>
        <div className="au-stat__row">
          <p className="au-stat__value">{value}</p>
          {sub && <p className="au-stat__sub">{sub}</p>}
        </div>
      </div>
    </>
  )

  if (to) return <Link to={to} className={cls} style={{ textDecoration: "none" }} data-testid={testId}>{inner}</Link>
  return <div className={cls} onClick={onClick} data-testid={testId}>{inner}</div>
}
