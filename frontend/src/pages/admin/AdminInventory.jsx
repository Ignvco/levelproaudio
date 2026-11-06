// pages/admin/AdminInventory.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getInventorySummary, getInventoryAlerts, getInventoryRotation,
} from "../../api/admin.api"
import { getAdminProducts } from "../../api/admin.api"
import { Coins, Tag, TrendingUp, Boxes, Ban, AlertTriangle } from "lucide-react"
import { StatCard, AdminPageHeader, SecondaryButton, StatusBadge, SectionCard, ErrorState } from "../../components/admin/ui"
import { formatCurrency } from "../../utils/accountingCurrency"
import { asInventoryRows, normalizeInventoryRotation, inventoryPreview, groupInventoryPreview } from "../../utils/inventoryViewData"

const TABS = ["Resumen","Alertas","Rotación","Por categoría"]
const fmt  = n => `$${Number(n||0).toLocaleString("es-CL")}`

// ── campos reales backend inventory_summary ──
// valor_inventario, valor_venta, ganancia_potencial
// total_productos, sin_stock, stock_critico, stock_ok

function KPI({ label, value, sub, Icon, variant = "light" }) {
  return <StatCard variant={variant} Icon={Icon} label={label} value={value} sub={sub} />
}

export default function AdminInventory() {
  const [tab, setTab] = useState(0)
  const [rotationCurrency, setRotationCurrency] = useState("CLP")

  const { data:summary, isLoading, isError:summaryError, refetch:refetchSummary } = useQuery({
    queryKey:["admin-inventory-summary"],
    queryFn: getInventorySummary,
    refetchInterval: 60000,
  })
  const { data:alerts, isError:alertsError, refetch:refetchAlerts } = useQuery({
    queryKey:["admin-inventory-alerts"],
    queryFn: getInventoryAlerts,
    enabled: tab === 1,
  })
  const { data:rotation, isError:rotationError, refetch:refetchRotation } = useQuery({
    queryKey:["admin-inventory-rotation", rotationCurrency],
    queryFn: () => getInventoryRotation(rotationCurrency),
    enabled: tab === 2,
  })
  // Productos reales para Resumen y Por Categoría
  const { data:productsData, isError:productsError, refetch:refetchProducts } = useQuery({
    queryKey:["admin-products-inventory"],
    queryFn: () => getAdminProducts({ page_size: 200 }),
    enabled: tab === 0 || tab === 3,
  })

  const alertsList = asInventoryRows(alerts)
  const rotationList = normalizeInventoryRotation(rotation)
  const { products, count: productCount, incomplete } = inventoryPreview(productsData)
  const categoryList = groupInventoryPreview(products)
  const maxUnitsSold = Math.max(1, ...rotationList.map(p => p.units ?? 0))
  const partialLabel = productCount != null ? `${products.length} de ${productCount}` : `${products.length}`

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / CATÁLOGO"
        title="Inventario"
        description="Control de stock, valorización financiera, alertas y rotación de productos"
        actions={
          <>
            <SecondaryButton to="/admin/products" size="sm">Productos</SecondaryButton>
            <SecondaryButton to="/admin/products/import" size="sm">Importar .xlsx</SecondaryButton>
          </>
        }
      />

      {/* Tabs */}
      <div className="lp-seg-tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(i)}
            className={`lp-seg-tab${tab === i ? " is-active" : ""}`}
          >
            {t}
            {i === 1 && alertsList.length > 0 && (
              <span style={{
                marginLeft: "6px", padding: "1px 6px",
                borderRadius: "9999px", fontSize: "10px",
                background: "#D97706", color: "#fff", fontWeight: 700,
              }}>
                {alertsList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab===0 && (
        summaryError ? (
          <ErrorState title="No pudimos consultar el inventario"
            description="No mostraremos valores de stock ni ganancias estimadas sin datos confirmados."
            action={<SecondaryButton onClick={() => refetchSummary()}>Reintentar</SecondaryButton>} />
        ) : isLoading ? (
          <div className="lp-kpi-strip">
            {[...Array(6)].map((_,i) => (
              <div key={i} className="skeleton" style={{ height:"130px", borderRadius: "20px" }} />
            ))}
          </div>
        ) : (
          <>
            <div className="lp-kpi-strip">
              <KPI variant="ink" label="Valor en inventario"
                value={fmt(summary?.valor_inventario)}
                sub="Capital invertido en stock"
                Icon={Coins} />
              <KPI variant="light" label="Valor a precio de venta"
                value={fmt(summary?.valor_venta)}
                sub="Si se vende todo el stock"
                Icon={Tag} />
              <KPI variant="primary" label="Ganancia potencial"
                value={fmt(summary?.ganancia_potencial)}
                sub="Venta − costo del stock"
                Icon={TrendingUp} />
              <KPI variant="light" label="Total productos"
                value={summary?.total_productos||0}
                sub="SKUs controlados"
                Icon={Boxes} />
              <KPI variant="light" label="Sin stock"
                value={summary?.sin_stock||0}
                sub={summary?.sin_stock===0 ? "✓ Sin problemas" : "Requiere reposición"}
                Icon={Ban} />
              <KPI variant="light" label="Stock crítico"
                value={summary?.stock_critico||0}
                sub="Bajo el mínimo configurado"
                Icon={AlertTriangle} />
            </div>

            {/* La lista es una vista de hasta 200 productos y NO un inventario completo. */}
            {productsError && <ErrorState title="No pudimos cargar el detalle por SKU"
              action={<SecondaryButton onClick={() => refetchProducts()}>Reintentar</SecondaryButton>} />}
            {!productsError && incomplete && (
              <div className="lp-callout lp-callout--warning" role="status">
                Vista parcial: {partialLabel} productos. Los KPIs generales provienen del resumen de inventario, no de esta muestra.
              </div>
            )}
            {!productsError && products.length > 0 && (
              <SectionCard
                eyebrow="EXISTENCIAS POR SKU"
                title={`Detalle de stock — ${products.length} productos${incomplete ? " (vista parcial)" : ""}`}
                flush
              >
                <div className="au-tscroll">
                  <table className="au-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th style={{ textAlign: "right" }}>Stock</th>
                        <th style={{ textAlign: "right" }}>Mínimo</th>
                        <th style={{ textAlign: "right" }}>Costo unit.</th>
                        <th style={{ textAlign: "right" }}>Valor stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--admin-text)" }}>{p.name}</p>
                            {p.sku && (
                              <p style={{ fontSize: "11px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
                                {p.sku}
                              </p>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <StatusBadge tone={p.stock === 0 ? "danger" : p.stock <= (p.stock_min ?? 3) ? "warning" : "success"}>
                              {p.stock} uds
                            </StatusBadge>
                          </td>
                          <td style={{ textAlign: "right", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
                            {p.stock_min ?? 3}
                          </td>
                          <td style={{ textAlign: "right", color: "var(--admin-text-secondary)", fontFamily: "var(--font-mono)" }}>
                            {p.cost_price ? fmt(p.cost_price) : "—"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                            {p.cost_price ? fmt(p.cost_price * p.stock) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}
          </>
        )
      )}

      {/* ── ALERTAS ── */}
      {tab===1 && (
        alertsError ? (
          <ErrorState title="No pudimos consultar las alertas de stock"
            description="La ausencia de información no significa que el stock esté saludable."
            action={<SecondaryButton onClick={() => refetchAlerts()}>Reintentar</SecondaryButton>} />
        ) : !alerts ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[...Array(4)].map((_,i) => (
              <div key={i} className="skeleton" style={{ height:"64px", borderRadius: "16px" }} />
            ))}
          </div>
        ) : alertsList.length===0 ? (
          <div className="au-card au-panel" style={{ padding:"48px", textAlign:"center" }}>
            <p style={{ fontSize:"42px", marginBottom:"10px" }}>✅</p>
            <h3 style={{ fontFamily:"var(--font-display)", fontWeight:800,
              fontSize:"1.25rem", marginBottom:"6px", color:"var(--admin-primary-text)" }}>
              Todo en orden
            </h3>
            <p style={{ fontSize:"13.5px", color:"var(--admin-text-secondary)" }}>
              Ningún producto está por debajo del stock mínimo.
            </p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {alertsList.map((p,i) => (
              <div key={i} className="au-card" style={{
                display:"flex", alignItems:"center",
                justifyContent:"space-between", padding:"18px 22px",
                borderLeft:`4px solid ${p.stock===0 ? "var(--admin-danger)" : "var(--admin-warning)"}`,
                flexWrap:"wrap", gap:"12px",
              }}>
                <div>
                  <p style={{ fontSize:"14px", fontWeight:700, color:"var(--admin-text)", marginBottom:"3px" }}>
                    {p.name}
                  </p>
                  <p style={{ fontSize:"12px", color:"var(--admin-text-muted)" }}>
                    {p.sku && <span style={{ fontFamily:"var(--font-mono)" }}>{p.sku} · </span>}
                    {p.category||"Sin categoría"}
                  </p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"24px" }}>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:"10px", color:"var(--admin-text-muted)",
                      textTransform:"uppercase", letterSpacing:"0.06em",
                      marginBottom:"2px", fontWeight: 700 }}>Stock actual</p>
                    <p style={{ fontFamily:"var(--font-display)", fontSize:"1.6rem", fontWeight: 800,
                      color: p.stock===0 ? "var(--admin-danger)" : "#D97706", lineHeight:1 }}>
                      {p.stock}
                    </p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:"10px", color:"var(--admin-text-muted)",
                      textTransform:"uppercase", letterSpacing:"0.06em",
                      marginBottom:"2px", fontWeight: 700 }}>Mínimo</p>
                    <p style={{ fontFamily:"var(--font-display)", fontSize:"1.6rem", fontWeight: 800,
                      color:"var(--admin-text-secondary)", lineHeight:1 }}>{p.stock_min}</p>
                  </div>
                  <StatusBadge tone={p.stock === 0 ? "danger" : "warning"}>
                    {p.stock===0 ? "Sin stock" : "Bajo mínimo"}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── ROTACIÓN ── */}
      {tab===2 && (
        <div className="au-page">
          <div className="au-card au-panel" style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <p style={{ fontSize:13, color:"var(--admin-text-secondary)" }}>
              Ventas de los últimos 30 días · Importes en la moneda original del pedido
            </p>
            <label style={{ display:"inline-flex", alignItems:"center", gap:8, fontSize:12, fontWeight:650 }}>
              Moneda
              <select className="au-select" aria-label="Moneda de rotación" value={rotationCurrency}
                onChange={e => setRotationCurrency(e.target.value)}>
                <option value="CLP">CLP</option><option value="USD">USD</option><option value="ARS">ARS</option>
              </select>
            </label>
          </div>
          {rotationError ? (
            <ErrorState title="No pudimos calcular la rotación"
              description="Los importes y unidades no están disponibles en este momento."
              action={<SecondaryButton onClick={() => refetchRotation()}>Reintentar</SecondaryButton>} />
          ) : !rotation ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[...Array(5)].map((_,i) => (
              <div key={i} className="skeleton" style={{ height:"56px", borderRadius: "14px" }} />
            ))}
          </div>
        ) : rotationList.length===0 ? (
          <div className="au-card au-panel" style={{ padding:"48px", textAlign:"center", color:"var(--admin-text-secondary)", fontSize:"14px" }}>
            Sin datos de rotación todavía.
          </div>
        ) : (
          <SectionCard eyebrow="VELOCIDAD DE SALIDA" title={`Ventas por producto · ${rotationCurrency}`} flush>
            <div className="au-tscroll">
              <table className="au-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: "right" }}>Vendidos</th>
                    <th style={{ textAlign: "right" }}>Stock</th>
                    <th style={{ textAlign: "right" }}>Ingreso</th>
                    <th>Ventas relativas 30d</th>
                  </tr>
                </thead>
                <tbody>
                  {rotationList.map((p,i) => (
                    <tr key={i}>
                      <td>
                        <p style={{ fontSize:"13px", fontWeight: 700, color: "var(--admin-text)" }}>{p.name}</p>
                        {p.sku && (
                          <p style={{ fontSize:"11px", color:"var(--admin-text-muted)",
                            fontFamily:"var(--font-mono)" }}>{p.sku}</p>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{p.units == null ? "—" : p.units}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.stock == null ? "—" : p.stock}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--admin-primary-text)", fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(p.revenue, p.currency)}
                      </td>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          <div style={{ flex:1, height:"6px", borderRadius:"9999px",
                            background:"var(--admin-surface-muted)", overflow:"hidden", maxWidth:"80px" }}>
                            <div style={{ height:"100%", borderRadius:"9999px",
                              background:"var(--admin-primary)",
                              width:`${p.units == null ? 0 : Math.min(100, Math.max(0, p.units / maxUnitsSold * 100))}%`,
                              transition:"width 600ms ease" }} />
                          </div>
                          <span style={{ fontSize:"11.5px", fontWeight: 700, color:"var(--admin-text-secondary)", fontFamily: "var(--font-mono)" }}>
                            {p.units == null ? "—" : p.units.toLocaleString("es-CL")} uds
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
          )}
        </div>
      )}

      {/* ── POR CATEGORÍA (agrupado en frontend) ── */}
      {tab===3 && (
        productsError ? (
          <ErrorState title="No pudimos cargar los productos por categoría"
            action={<SecondaryButton onClick={() => refetchProducts()}>Reintentar</SecondaryButton>} />
        ) : !productsData ? (
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:"14px" }}>
            {[...Array(4)].map((_,i) => (
              <div key={i} className="skeleton" style={{ height:"140px", borderRadius: "18px" }} />
            ))}
          </div>
        ) : categoryList.length===0 ? (
          <div className="au-card au-panel" style={{ padding:"48px", textAlign:"center", color:"var(--admin-text-secondary)", fontSize:"14px" }}>
            Sin productos registrados.
          </div>
        ) : (
          <div>
            {incomplete && <div className="lp-callout lp-callout--warning" role="status" style={{ marginBottom:14 }}>
              Vista parcial ({partialLabel} productos). No uses estos subtotales como valorización completa por categoría.
            </div>}
            <div style={{ display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(250px, 1fr))", gap:"14px" }}>
            {categoryList.map((cat,i) => (
              <div key={i} className="au-card au-panel">
                <p style={{ fontSize:"15px", fontWeight:800, color:"var(--admin-text)", marginBottom:"14px", letterSpacing: "-0.02em" }}>
                  {cat.name}
                </p>
                {[
                  { label:"Productos",   value: cat.products },
                  { label:"Stock total", value: cat.totalStock     },
                  { label:"Valor costo", value: cat.missingCostCount > 0 ? `≥ ${fmt(cat.knownCost)} · parcial` : fmt(cat.knownCost) },
                  { label:"Valor venta", value: fmt(cat.saleValue) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display:"flex",
                    justifyContent:"space-between",
                    fontSize:"13px", marginBottom:"8px" }}>
                    <span style={{ color:"var(--admin-text-secondary)" }}>{label}</span>
                    <span style={{ fontWeight:700, fontFamily: "var(--font-mono)", color:"var(--admin-text)" }}>{value}</span>
                  </div>
                ))}
              </div>
            ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}