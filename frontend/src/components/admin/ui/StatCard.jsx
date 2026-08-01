// components/admin/ui/StatCard.jsx
import { Link } from "react-router-dom"
import { TrendingUp, TrendingDown } from "lucide-react"

export function MetricBadge({ delta, className = "" }) {
  if (delta === undefined || delta === null) return null
  const pos = delta >= 0
  return (
    <span className={`au-lp__delta ${pos ? "au-lp__delta--pos" : "au-lp__delta--neg"} ${className}`} data-testid="metric-badge">
      {pos ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
      {Math.abs(delta)}{typeof delta === "number" ? "%" : ""}
    </span>
  )
}

/**
 * StatCard — lenguaje de las cards del front LevelPro (ProductCard / CourseCard).
 * variant: "dark" (default) | "primary" (glow verde) | "light" | "compact"
 */
export function StatCard({
  Icon, label, value, sub, delta, deltaSuffix = "%", badge,
  variant = "dark", to, onClick, loading = false, interactive, testId,
}) {
  if (loading) return <div className="au-lp au-skel" style={{ height: 152, background: undefined }} data-testid={testId ? `${testId}-loading` : undefined} />

  const isInteractive = interactive ?? Boolean(to || onClick)
  const cls = `au-lp au-lp--${variant} ${isInteractive ? "au-lp--interactive" : ""}`.trim()
  const hasFoot = sub != null || delta != null || badge

  const inner = (
    <>
      <div className="au-lp__top">
        {label && <span className="au-lp__tag">{label}</span>}
        {Icon && <span className="au-lp__icon"><Icon size={variant === "compact" ? 17 : 20} strokeWidth={2} /></span>}
      </div>
      <div className="au-lp__value">{value}</div>
      {hasFoot && (
        <div className="au-lp__foot">
          {sub != null && <span className="au-lp__pill">{sub}</span>}
          {delta != null && (
            <span className={`au-lp__delta ${delta >= 0 ? "au-lp__delta--pos" : "au-lp__delta--neg"}`}>
              {delta >= 0 ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
              {Math.abs(delta)}{deltaSuffix}
            </span>
          )}
          {badge}
        </div>
      )}
    </>
  )

  if (to) return <Link to={to} className={cls} data-testid={testId}>{inner}</Link>
  return <div className={cls} onClick={onClick} data-testid={testId}>{inner}</div>
}
