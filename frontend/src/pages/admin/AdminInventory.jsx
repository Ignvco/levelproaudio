// pages/admin/AdminInventory.jsx

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getInventorySummary,
  getInventoryAlerts,
  getInventoryRotation,
  getInventoryByCategory,
} from "../../api/admin.api"

const TABS = ["Resumen", "Alertas", "Rotación", "Por categoría"]

function KPICard({ label, value, sub, color = "var(--text)", icon }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "20px 24px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "12px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-3)",
          textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
          {label}
        </p>
        {icon && <span style={{ fontSize: "20px" }}>{icon}</span>}
      </div>
      <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem",
        color, lineHeight: 1, marginBottom: "4px" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "12px", color: "var(--text-3)" }}>{sub}</p>}
    </div>
  )
}

function StockBar({ stock, stockMin }) {
  const pct = stockMin > 0 ? Math.min((stock / (stockMin * 3)) * 100, 100) : 100
  const color = stock === 0 ? "#f87171" : stock <= stockMin ? "#facc15" : "#4ade80"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ flex: 1, height: "6px", borderRadius: "3px",
        background: "var(--surface-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%",
          background: color, borderRadius: "3px",
          transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color, minWidth: "24px" }}>
        {stock}
      </span>
    </div>
  )
}

// ── Tab Resumen ───────────────────────────────────────────────
function TabResumen() {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn:  getInventorySummary,
  })

  if (isLoading) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
      gap: "16px" }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "100px" }} />
      ))}
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* KPIs financieros */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <KPICard
          label="Valor en inventario"
          value={`$${Math.round(data?.valor_inventario || 0).toLocaleString("es-CL")}`}
          sub="Capital invertido en stock"
          color="var(--accent)"
          icon="💰"
        />
        <KPICard
          label="Valor a precio de venta"
          value={`$${Math.round(data?.valor_venta || 0).toLocaleString("es-CL")}`}
          sub="Si se vende todo el stock"
          color="#60a5fa"
          icon="🏷️"
        />
        <KPICard
          label="Ganancia potencial"
          value={`$${Math.round(data?.ganancia_potencial || 0).toLocaleString("es-CL")}`}
          sub="Venta − costo del stock"
          color="#4ade80"
          icon="📈"
        />
      </div>

      {/* KPIs de stock */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
        <KPICard
          label="Total productos"
          value={data?.total_productos || 0}
          icon="📦"
        />
        <KPICard
          label="Sin stock"
          value={data?.sin_stock || 0}
          color={data?.sin_stock > 0 ? "#f87171" : "var(--text)"}
          sub={data?.sin_stock > 0 ? "⚠️ Requieren atención" : "✓ Sin problemas"}
          icon="🚨"
        />
        <KPICard
          label="Stock crítico"
          value={data?.stock_critico || 0}
          color={data?.stock_critico > 0 ? "#facc15" : "var(--text)"}
          sub="Bajo el mínimo configurado"
          icon="⚠️"
        />
        <KPICard
          label="Stock OK"
          value={data?.stock_ok || 0}
          color="#4ade80"
          sub="Sobre el mínimo"
          icon="✅"
        />
      </div>

      {/* Barra visual de estado */}
      {data && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "20px 24px",
        }}>
          <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "14px" }}>
            Estado general del inventario
          </p>
          <div style={{ display: "flex", height: "12px", borderRadius: "6px",
            overflow: "hidden", gap: "2px" }}>
            {[
              { val: data.stock_ok,      color: "#4ade80", label: "OK" },
              { val: data.stock_critico, color: "#facc15", label: "Crítico" },
              { val: data.sin_stock,     color: "#f87171", label: "Sin stock" },
            ].map(({ val, color, label }) => {
              const pct = data.total_productos > 0
                ? (val / data.total_productos) * 100 : 0
              return pct > 0 ? (
                <div key={label} title={`${label}: ${val}`}
                  style={{ width: `${pct}%`, background: color,
                    borderRadius: "3px", transition: "width 0.5s ease" }} />
              ) : null
            })}
          </div>
          <div style={{ display: "flex", gap: "20px", marginTop: "10px",
            fontSize: "12px", color: "var(--text-3)" }}>
            {[
              { color: "#4ade80", label: `OK (${data.stock_ok})` },
              { color: "#facc15", label: `Crítico (${data.stock_critico})` },
              { color: "#f87171", label: `Sin stock (${data.sin_stock})` },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px",
                  borderRadius: "50%", background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Alertas ───────────────────────────────────────────────
function TabAlertas() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory-alerts"],
    queryFn:  getInventoryAlerts,
  })

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "60px" }} />
      ))}
    </div>
  )

  if (data.length === 0) return (
    <div style={{
      padding: "60px", textAlign: "center",
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)",
    }}>
      <p style={{ fontSize: "32px", marginBottom: "12px" }}>✅</p>
      <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "6px" }}>
        Todo el stock está OK
      </p>
      <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
        No hay productos bajo el stock mínimo.
      </p>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{
        padding: "12px 16px", borderRadius: "var(--r-md)",
        background: "rgba(248,113,113,0.06)",
        border: "1px solid rgba(248,113,113,0.2)",
        fontSize: "13px", color: "#f87171",
        display: "flex", alignItems: "center", gap: "8px",
      }}>
        <span>⚠️</span>
        <span>{data.length} producto{data.length !== 1 ? "s" : ""} requieren
        reposición urgente</span>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr",
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          <span>Producto</span>
          <span>Stock actual</span>
          <span>Stock mínimo</span>
          <span>Estado</span>
          <span>Costo reponer</span>
        </div>

        {data.map((p, i) => (
          <div key={p.id} style={{
            display: "grid",
            gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr",
            padding: "14px 20px", alignItems: "center",
            borderTop: i > 0 ? "1px solid var(--border)" : "none",
            background: p.status === "sin_stock"
              ? "rgba(248,113,113,0.03)" : "transparent",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {p.image ? (
                <img src={p.image} alt={p.name}
                  style={{ width: "36px", height: "36px", objectFit: "cover",
                    borderRadius: "var(--r-sm)", flexShrink: 0 }} />
              ) : (
                <div style={{ width: "36px", height: "36px",
                  background: "var(--surface-2)", borderRadius: "var(--r-sm)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", flexShrink: 0 }}>
                  📦
                </div>
              )}
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500,
                  marginBottom: "2px" }}>
                  {p.name}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                  {p.brand || p.category || p.sku}
                </p>
              </div>
            </div>

            <div>
              <StockBar stock={p.stock} stockMin={p.stock_min} />
            </div>

            <span style={{ fontSize: "13px", color: "var(--text-3)" }}>
              {p.stock_min} u.
            </span>

            <span style={{
              padding: "3px 8px", borderRadius: "100px", fontSize: "11px",
              fontWeight: 500,
              color: p.status === "sin_stock" ? "#f87171" : "#facc15",
              background: p.status === "sin_stock"
                ? "rgba(248,113,113,0.1)" : "rgba(250,204,21,0.1)",
              border: `1px solid ${p.status === "sin_stock"
                ? "rgba(248,113,113,0.2)" : "rgba(250,204,21,0.2)"}`,
            }}>
              {p.status === "sin_stock" ? "Sin stock" : "Crítico"}
            </span>

            <span style={{ fontSize: "13px", color: "var(--text-3)" }}>
              {p.cost_price
                ? `$${(p.cost_price * p.stock_min).toLocaleString("es-CL")}`
                : "—"
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab Rotación ──────────────────────────────────────────────
function TabRotacion() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory-rotation"],
    queryFn:  getInventoryRotation,
  })

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "52px" }} />
      ))}
    </div>
  )

  const maxUnidades = Math.max(...data.map(d => d.unidades_vendidas), 1)

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", overflow: "hidden" }}>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: "13px", fontWeight: 600 }}>
          Rotación últimos 30 días
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
          Top {data.length} productos
        </p>
      </div>

      {data.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center",
          color: "var(--text-3)", fontSize: "14px" }}>
          Sin ventas en los últimos 30 días.
        </div>
      ) : data.map((p, i) => (
        <div key={p.product_id || i} style={{
          padding: "14px 20px",
          borderTop: i > 0 ? "1px solid var(--border)" : "none",
          display: "flex", alignItems: "center", gap: "16px",
        }}>
          <span style={{ fontSize: "12px", color: "var(--text-3)",
            fontFamily: "monospace", minWidth: "20px" }}>
            #{i + 1}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "6px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500,
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap" }}>
                {p.name}
              </p>
              <span style={{ fontSize: "12px", color: "var(--text-3)",
                flexShrink: 0, marginLeft: "12px" }}>
                {p.unidades_vendidas} u. vendidas
              </span>
            </div>
            {/* Barra de rotación */}
            <div style={{ height: "4px", borderRadius: "2px",
              background: "var(--surface-3)", overflow: "hidden" }}>
              <div style={{
                width: `${(p.unidades_vendidas / maxUnidades) * 100}%`,
                height: "100%", borderRadius: "2px",
                background: i === 0 ? "var(--accent)"
                  : i < 3 ? "#60a5fa" : "var(--border-hover)",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 500 }}>
              ${Math.round(p.ingresos).toLocaleString("es-CL")}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
              Stock: {p.stock_actual}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab Por Categoría ─────────────────────────────────────────
function TabPorCategoria() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["inventory-by-category"],
    queryFn:  getInventoryByCategory,
  })

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "70px" }} />
      ))}
    </div>
  )

  const maxValor = Math.max(...data.map(d => d.valor_inventario), 1)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {data.map((cat, i) => (
        <div key={cat.category} style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "16px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "10px" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500,
                marginBottom: "2px" }}>
                {cat.category}
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {cat.productos} productos · {cat.unidades} unidades en stock
              </p>
            </div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.3rem",
              color: "var(--accent)" }}>
              ${Math.round(cat.valor_inventario).toLocaleString("es-CL")}
            </p>
          </div>
          <div style={{ height: "6px", borderRadius: "3px",
            background: "var(--surface-3)", overflow: "hidden" }}>
            <div style={{
              width: `${(cat.valor_inventario / maxValor) * 100}%`,
              height: "100%", borderRadius: "3px",
              background: "var(--accent)", opacity: 0.7,
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function AdminInventory() {
  const [tab, setTab] = useState(0)

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Inventario
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          Control de stock, alertas y rotación de productos
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px",
        borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "8px 16px", fontSize: "13px", cursor: "pointer",
            background: "none", border: "none",
            borderBottom: tab === i ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === i ? "var(--accent)" : "var(--text-3)",
            fontWeight: tab === i ? 500 : 400,
            transition: "all var(--dur) var(--ease)",
            marginBottom: "-1px",
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 0 && <TabResumen />}
      {tab === 1 && <TabAlertas />}
      {tab === 2 && <TabRotacion />}
      {tab === 3 && <TabPorCategoria />}
    </div>
  )
}