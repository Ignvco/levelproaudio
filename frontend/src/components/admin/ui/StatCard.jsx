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
 * StatCard — tarjeta KPI oficial de LevelPro Audio.
 * variant:
 *  - "dark" | "light" → superficie clara (#FFFFFF) por compatibilidad con vistas existentes
 *  - "primary"        → superficie verde marca (#1AFF6E) con texto oscuro (#00160B)
 *  - "ink"            → superficie negra destacada (#141517) con texto blanco y acento #1AFF6E
 *  - "compact"        → versión compacta para grillas densas
 */
export function StatCard({
  Icon, icon, label, title, value, sub, description, delta, deltaSuffix = "%", badge,
  variant = "dark", to, onClick, loading = false, interactive, testId,
}) {
  if (loading) return <div className="au-lp au-skel" style={{ height: 152, background: undefined }} data-testid={testId ? `${testId}-loading` : undefined} />

  const lbl = label || title
  const s = sub || description
  const IconComp = Icon || (typeof icon === "function" ? icon : null)
  const renderedIcon = IconComp ? <IconComp size={variant === "compact" ? 17 : 20} strokeWidth={2} /> : (icon || null)

  const isInteractive = interactive ?? Boolean(to || onClick)
  const cls = `au-lp au-lp--${variant} ${isInteractive ? "au-lp--interactive" : ""}`.trim()
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
  if (onClick) return <button type="button" className={cls} onClick={onClick} data-testid={testId}
    style={{ width: "100%", textAlign: "left", cursor: "pointer", font: "inherit" }}>{inner}</button>
  return <div className={cls} data-testid={testId}>{inner}</div>
}
