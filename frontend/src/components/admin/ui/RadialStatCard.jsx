// components/admin/ui/RadialStatCard.jsx
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { MetricBadge } from "./StatCard"
import { EmptyState } from "./EmptyState"

// Paleta derivada de la marca (verdes/teales + neutros cálidos)
export const BRAND_CHART_COLORS = ["#1AFF6E", "#0F9940", "#14B8A6", "#5EEAD4", "#A7F3D0", "#CA8A04", "#78716C", "#D6D3D1"]

export function RadialStatCard({
  title, description, total, totalLabel = "Total", delta,
  data = [], loading = false, testId,
}) {
  if (loading) return <div className="au-card au-skel" style={{ height: 280 }} data-testid={testId ? `${testId}-loading` : undefined} />

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
          <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none">
                  {items.map((it, i) => <Cell key={i} fill={it.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--admin-text)", lineHeight: 1 }}>{total ?? sum}</span>
              <span style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 3 }}>{totalLabel}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 160 }}>
            {items.map((it, i) => {
              const pct = sum ? Math.round((it.value / sum) * 100) : 0
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--admin-text-muted)" }}>
                    <span className="au-legend__dot" style={{ background: it.color }} />{it.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                    {it.value} <span style={{ fontSize: 11, color: "var(--admin-text-muted)", fontWeight: 500 }}>· {pct}%</span>
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
