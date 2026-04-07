// pages/admin/AdminInventory.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getInventorySummary, getInventoryAlerts,
  getInventoryRotation, getInventoryByCategory,
} from "../../api/admin.api"

const TABS = ["Resumen","Alertas","Rotación","Por categoría"]
const fmt  = n => `$${Number(n||0).toLocaleString("es-CL")}`

function KPI({ label, value, sub, icon, color="var(--text)" }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"20px 24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"10px" }}>
        <p style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:500,
          textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</p>
        {icon && <span style={{ fontSize:"20px" }}>{icon}</span>}
      </div>
      <p style={{ fontFamily:"var(--font-serif)", fontSize:"2rem",
        lineHeight:1, marginBottom:"4px", color }}>{value}</p>
      {sub && <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{sub}</p>}
    </div>
  )
}

export default function AdminInventory() {
  const [tab, setTab] = useState(0)

  const { data:summary, isLoading } = useQuery({
    queryKey:["admin-inventory-summary"], queryFn:getInventorySummary,
    refetchInterval:60000,
  })
  const { data:alerts } = useQuery({
    queryKey:["admin-inventory-alerts"], queryFn:getInventoryAlerts,
    enabled: tab === 1,
  })
  const { data:rotation } = useQuery({
    queryKey:["admin-inventory-rotation"], queryFn:getInventoryRotation,
    enabled: tab === 2,
  })
  const { data:byCategory } = useQuery({
    queryKey:["admin-inventory-by-category"], queryFn:getInventoryByCategory,
    enabled: tab === 3,
  })

  const alertsList    = alerts?.results    || alerts    || []
  const rotationList  = rotation?.results  || rotation  || []
  const categoryList  = byCategory?.results|| byCategory|| []

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      <div style={{ marginBottom:"28px" }}>
        <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.4rem)",
          fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>Inventario</h1>
        <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
          Control de stock, alertas y rotación de productos
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0", marginBottom:"28px", borderBottom:"1px solid var(--border)" }}>
        {TABS.map((t,i) => (
          <button key={t} type="button" onClick={() => setTab(i)} style={{
            padding:"9px 20px", fontSize:"13px", cursor:"pointer",
            background:"none", border:"none",
            borderBottom: tab===i ? "2px solid var(--accent)" : "2px solid transparent",
            color:        tab===i ? "var(--accent)"             : "var(--text-3)",
            fontWeight:   tab===i ? 500                         : 400,
            marginBottom:"-1px", transition:"all var(--dur) var(--ease)" }}>
            {t}
            {i===1 && alertsList.length > 0 && (
              <span style={{ marginLeft:"6px", padding:"1px 6px", borderRadius:"var(--r-full)",
                fontSize:"10px", background:"#facc15", color:"#000", fontWeight:700 }}>
                {alertsList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab===0 && (
        isLoading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"12px" }}>
            {[...Array(6)].map((_,i) => <div key={i} className="skeleton" style={{ height:"110px" }} />)}
          </div>
        ) : summary ? (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
              gap:"14px", marginBottom:"28px" }}>
              <KPI label="Valor en inventario"
                value={fmt(summary.total_cost_value)} sub="Capital invertido en stock"
                icon="💰" color="var(--accent)" />
              <KPI label="Valor a precio de venta"
                value={fmt(summary.total_sale_value)} sub="Si se vende todo el stock"
                icon="🏷" color="#60a5fa" />
              <KPI label="Ganancia potencial"
                value={fmt((summary.total_sale_value||0)-(summary.total_cost_value||0))}
                sub="Venta − costo del stock" icon="📈" color="#4ade80" />
              <KPI label="Total productos" value={summary.total_products||0} icon="📦" />
              <KPI label="Sin stock" value={summary.out_of_stock||0}
                sub={summary.out_of_stock===0 ? "✓ Sin problemas" : "Requiere reposición"}
                icon="🚫" color={summary.out_of_stock > 0 ? "var(--danger)" : "var(--text)"} />
              <KPI label="Stock crítico" value={summary.low_stock||0}
                sub="Bajo el mínimo configurado" icon="⚠️"
                color={summary.low_stock > 0 ? "#facc15" : "var(--text)"} />
            </div>

            {summary.products?.length > 0 && (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
                borderRadius:"var(--r-xl)", overflow:"hidden" }}>
                <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border)",
                  background:"var(--surface-2)" }}>
                  <p style={{ fontSize:"13px", fontWeight:500 }}>Detalle de stock</p>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 1fr 1fr 1fr",
                  padding:"10px 20px", borderBottom:"1px solid var(--border)",
                  fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
                  letterSpacing:"0.06em", fontWeight:500 }}>
                  <span>Producto</span><span>Stock</span>
                  <span>Mínimo</span><span>Costo unit.</span><span>Valor stock</span>
                </div>
                {summary.products.map((p,i) => (
                  <div key={p.id} style={{ display:"grid",
                    gridTemplateColumns:"2.5fr 1fr 1fr 1fr 1fr",
                    padding:"12px 20px", alignItems:"center",
                    borderTop: i>0 ? "1px solid var(--border)" : "none",
                    transition:"background var(--dur) var(--ease)" }}
                    onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div>
                      <p style={{ fontSize:"13px", fontWeight:500 }}>{p.name}</p>
                      {p.sku && <p style={{ fontSize:"11px", color:"var(--text-3)", fontFamily:"monospace" }}>{p.sku}</p>}
                    </div>
                    <span style={{ fontSize:"14px", fontWeight:600,
                      color: p.stock===0 ? "var(--danger)" : p.stock<=(p.stock_min||3) ? "#facc15" : "var(--accent)" }}>
                      {p.stock}
                    </span>
                    <span style={{ fontSize:"13px", color:"var(--text-3)" }}>{p.stock_min||3}</span>
                    <span style={{ fontSize:"13px", color:"var(--text-2)" }}>
                      {p.cost_price ? fmt(p.cost_price) : "—"}
                    </span>
                    <span style={{ fontSize:"13px", fontWeight:500 }}>
                      {p.cost_price ? fmt(p.cost_price * p.stock) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null
      )}

      {/* ── ALERTAS ── */}
      {tab===1 && (
        !alerts ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:"64px" }} />)}
          </div>
        ) : alertsList.length===0 ? (
          <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)",
            border:"1px solid rgba(26,255,110,0.2)", borderRadius:"var(--r-2xl)" }}>
            <p style={{ fontSize:"48px", marginBottom:"12px" }}>✅</p>
            <h3 style={{ fontFamily:"var(--font-serif)", fontWeight:300,
              fontSize:"1.4rem", marginBottom:"8px", color:"var(--accent)" }}>
              Todo en orden
            </h3>
            <p style={{ fontSize:"14px", color:"var(--text-3)" }}>
              Ningún producto está por debajo del stock mínimo.
            </p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {alertsList.map((p,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", padding:"18px 22px",
                background:"var(--surface)",
                border:`1px solid ${p.stock===0 ? "rgba(248,113,113,0.25)" : "rgba(250,204,21,0.2)"}`,
                borderLeft:`3px solid ${p.stock===0 ? "var(--danger)" : "#facc15"}`,
                borderRadius:"var(--r-xl)", flexWrap:"wrap", gap:"12px" }}>
                <div>
                  <p style={{ fontSize:"14px", fontWeight:500, marginBottom:"3px" }}>{p.name}</p>
                  <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
                    {p.sku && <span style={{ fontFamily:"monospace" }}>{p.sku} · </span>}
                    {p.category||"Sin categoría"}
                  </p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"24px" }}>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:"0.06em", marginBottom:"2px" }}>Stock actual</p>
                    <p style={{ fontFamily:"var(--font-serif)", fontSize:"2rem",
                      color: p.stock===0 ? "var(--danger)" : "#facc15", lineHeight:1 }}>
                      {p.stock}
                    </p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
                      letterSpacing:"0.06em", marginBottom:"2px" }}>Mínimo</p>
                    <p style={{ fontFamily:"var(--font-serif)", fontSize:"2rem",
                      color:"var(--text-3)", lineHeight:1 }}>{p.stock_min}</p>
                  </div>
                  <span style={{ padding:"4px 12px", borderRadius:"var(--r-full)",
                    fontSize:"12px", fontWeight:600,
                    color:      p.stock===0 ? "var(--danger)" : "#facc15",
                    background: p.stock===0 ? "rgba(248,113,113,0.1)" : "rgba(250,204,21,0.1)",
                    border:     `1px solid ${p.stock===0 ? "rgba(248,113,113,0.3)" : "rgba(250,204,21,0.3)"}` }}>
                    {p.stock===0 ? "Sin stock" : "Bajo mínimo"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── ROTACIÓN ── */}
      {tab===2 && (
        !rotation ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:"56px" }} />)}
          </div>
        ) : rotationList.length===0 ? (
          <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
            color:"var(--text-3)", fontSize:"14px" }}>
            Sin datos de rotación todavía.
          </div>
        ) : (
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 1fr 1fr 1fr",
              padding:"10px 20px", borderBottom:"1px solid var(--border)",
              fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:"0.06em", fontWeight:500 }}>
              <span>Producto</span><span>Vendidos</span>
              <span>Stock</span><span>Ingreso</span><span>Rotación</span>
            </div>
            {rotationList.map((p,i) => (
              <div key={i} style={{ display:"grid",
                gridTemplateColumns:"2.5fr 1fr 1fr 1fr 1fr",
                padding:"13px 20px", alignItems:"center",
                borderTop: i>0 ? "1px solid var(--border)" : "none",
                transition:"background var(--dur) var(--ease)" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <div>
                  <p style={{ fontSize:"13px", overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</p>
                  {p.sku && <p style={{ fontSize:"11px", color:"var(--text-3)", fontFamily:"monospace" }}>{p.sku}</p>}
                </div>
                <span style={{ fontSize:"13px", fontWeight:500 }}>{p.units_sold}</span>
                <span style={{ fontSize:"13px" }}>{p.stock}</span>
                <span style={{ fontSize:"13px", color:"var(--accent)" }}>{fmt(p.total_revenue||0)}</span>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <div style={{ flex:1, height:"4px", borderRadius:"2px",
                    background:"var(--surface-3)", overflow:"hidden", maxWidth:"60px" }}>
                    <div style={{ height:"100%", borderRadius:"2px", background:"var(--accent)",
                      width:`${Math.min(100,(p.rotation_index||0)*10)}%`,
                      transition:"width 600ms var(--ease)" }} />
                  </div>
                  <span style={{ fontSize:"11px", color:"var(--text-3)" }}>
                    {p.rotation_index?.toFixed(1)||"0"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── POR CATEGORÍA ── */}
      {tab===3 && (
        !byCategory ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"12px" }}>
            {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:"120px" }} />)}
          </div>
        ) : categoryList.length===0 ? (
          <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
            color:"var(--text-3)", fontSize:"14px" }}>
            Sin datos por categoría todavía.
          </div>
        ) : (
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"14px" }}>
            {categoryList.map((cat,i) => (
              <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)",
                borderRadius:"var(--r-xl)", padding:"20px",
                transition:"all var(--dur-slow) var(--ease)" }}
                className="card card-glow">
                <p style={{ fontSize:"14px", fontWeight:500, marginBottom:"16px" }}>{cat.name}</p>
                {[
                  { label:"Productos",   value: cat.product_count         },
                  { label:"Stock total", value: cat.total_stock           },
                  { label:"Valor costo", value: fmt(cat.total_cost||0)    },
                  { label:"Valor venta", value: fmt(cat.total_sale||0)    },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between",
                    fontSize:"13px", marginBottom:"8px" }}>
                    <span style={{ color:"var(--text-3)" }}>{label}</span>
                    <span style={{ fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
