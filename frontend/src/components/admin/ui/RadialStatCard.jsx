// components/admin/ui/RadialStatCard.jsx
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { MetricBadge } from "./StatCard"
import { EmptyState } from "./EmptyState"

// Paleta sobria calibrada para LevelPro Precision (evita saturación excesiva)
// eslint-disable-next-line react-refresh/only-export-components
export const BRAND_CHART_COLORS = ["#09090B", "#242A34", "#16A34A", "#52525B", "#71717A", "#A1A1AA", "#D4D4D8", "#0F7A38"]

export function RadialStatCard({
  title, description, total, totalLabel = "Total", delta,
  data = [], loading = false, testId, valueFormatter = (v) => v,
}) {
  if (loading) return <div className="au-card au-skel" style={{ height: 260 }} data-testid={testId ? `${testId}-loading` : undefined} />

  const items = data.map((d, i) => ({ ...d, color: d.color || BRAND_CHART_COLORS[i % BRAND_CHART_COLORS.length] }))
  const sum = items.reduce((a, b) => a + (b.value || 0), 0)
  const isEmpty = sum === 0

  return (
    <div className="au-card au-panel" data-testid={testId}>
      <div className="au-panel__head">
        <div>
          {title && <h2 className="au-panel__title">{title}</h2>}
          {description && <p className="au-panel__desc">{description}</p>}
        </div>
        <MetricBadge delta={delta} />
      </div>

      {isEmpty ? (
        <EmptyState title="Sin datos todavía" description="Cuando haya actividad la verás acá." />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={72} paddingAngle={2} stroke="none">
                  {items.map((it, i) => <Cell key={i} fill={it.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", padding: "0 8px", textAlign: "center" }}>
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.02em", color: "var(--lp-text-primary, #09090B)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{total != null ? valueFormatter(total) : valueFormatter(sum)}</span>
              <span style={{ fontSize: 11, color: "var(--lp-text-muted, #71717A)", marginTop: 2 }}>{totalLabel}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 160 }}>
            {items.map((it, i) => {
              const pct = sum ? Math.round((it.value / sum) * 100) : 0
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--lp-text-secondary, #52525B)" }}>
                    <span className="au-legend__dot" style={{ background: it.color }} />{it.name}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lp-text-primary, #09090B)", fontVariantNumeric: "tabular-nums" }}>
                    {valueFormatter(it.value)} <span style={{ fontSize: 11, color: "var(--lp-text-muted, #71717A)", fontWeight: 400 }}>· {pct}%</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
