// pages/admin/AdminOrders.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminOrders, updateOrderStatus,
  generateDocumentFromOrder, downloadDocument,
} from "../../api/admin.api"

const STATUS = {
  pending:   { label:"Pendiente",  color:"#facc15" },
  paid:      { label:"Pagado",     color:"#4ade80" },
  shipped:   { label:"Enviado",    color:"#60a5fa" },
  completed: { label:"Completado", color:"#4ade80" },
  cancelled: { label:"Cancelado",  color:"#f87171" },
}

function Badge({ status }) {
  const s = STATUS[status] || { label:status, color:"#888" }
  return (
    <span style={{ padding:"2px 10px", borderRadius:"var(--r-full)", fontSize:"11px",
      fontWeight:500, color:s.color, background:`${s.color}14`,
      border:`1px solid ${s.color}30`, whiteSpace:"nowrap" }}>
      {s.label}
    </span>
  )
}

function OrderPanel({ order, onClose }) {
  const queryClient      = useQueryClient()
  const [docResult, setDocResult] = useState(null)

  const statusMutation = useMutation({
    mutationFn: (s) => updateOrderStatus(order.id, s),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-orders"])
      queryClient.invalidateQueries(["admin-dashboard"])
      queryClient.invalidateQueries(["admin-payments"])
      queryClient.invalidateQueries(["admin-finance-summary"])
    },
  })

  const docMutation = useMutation({
    mutationFn: (tipo) => generateDocumentFromOrder(order.id, tipo),
    onSuccess:  (data) => setDocResult(data),
    onError:    (e)    => alert(e?.response?.data?.error || "Error al generar."),
  })

  const handleDownload = async (id, folio) => {
    const resp = await downloadDocument(id)
    const url  = window.URL.createObjectURL(new Blob([resp.data]))
    const a    = document.createElement("a")
    a.href = url
    a.setAttribute("download", `${folio}.pdf`)
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:99,
        background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }} />

      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"440px", zIndex:100,
        background:"var(--surface)", borderLeft:"1px solid var(--border)",
        display:"flex", flexDirection:"column",
        boxShadow:"-24px 0 60px rgba(0,0,0,0.4)",
        animation:"slideInRight 250ms var(--ease)" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background:"var(--surface-2)", flexShrink:0 }}>
          <div>
            <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:"4px" }}>Orden</p>
            <p style={{ fontSize:"16px", fontWeight:600, fontFamily:"monospace" }}>
              #{order.id.slice(0,8).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} style={{ background:"var(--surface-3)",
            border:"1px solid var(--border)", borderRadius:"50%", width:"32px", height:"32px",
            cursor:"pointer", color:"var(--text-3)", fontSize:"16px",
            display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px",
          display:"flex", flexDirection:"column", gap:"16px" }}>

          {/* Estado */}
          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", padding:"18px" }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:"12px" }}>Estado</p>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:"14px" }}>
              <Badge status={order.status} />
              <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
                {new Date(order.created_at).toLocaleDateString("es-CL", {
                  day:"numeric", month:"long", year:"numeric" })}
              </span>
            </div>
            <p style={{ fontSize:"11px", color:"var(--text-3)", marginBottom:"8px" }}>
              Cambiar a:
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
              {Object.entries(STATUS)
                .filter(([s]) => s !== order.status)
                .map(([s, { label, color }]) => (
                  <button key={s} onClick={() => statusMutation.mutate(s)}
                    disabled={statusMutation.isPending}
                    style={{ padding:"5px 12px", borderRadius:"var(--r-full)",
                      fontSize:"12px", fontWeight:500, cursor:"pointer",
                      color, background:`${color}10`, border:`1px solid ${color}25`,
                      transition:"all var(--dur) var(--ease)",
                      opacity: statusMutation.isPending ? 0.5 : 1 }}>
                    → {label}
                  </button>
                ))}
            </div>
            {statusMutation.isSuccess && (
              <p style={{ fontSize:"12px", color:"var(--accent)", marginTop:"8px" }}>
                ✓ Estado actualizado
              </p>
            )}
          </div>

          {/* Cliente */}
          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", padding:"18px" }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:"12px" }}>Cliente</p>
            {[
              { label:"Email",     value: order.email },
              { label:"Dirección", value: order.shipping_address },
              ...(order.notes ? [{ label:"Notas", value: order.notes }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display:"flex", gap:"12px", fontSize:"13px",
                marginBottom:"8px" }}>
                <span style={{ color:"var(--text-3)", flexShrink:0, minWidth:"72px" }}>
                  {label}
                </span>
                <span style={{ color:"var(--text-2)", wordBreak:"break-word" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Productos */}
          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", overflow:"hidden" }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:"0.08em", padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
              Productos ({order.items_count})
            </p>
            {order.items?.map((item, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"11px 16px",
                borderBottom: i < order.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <p style={{ fontSize:"13px", overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {item.product_name}
                  </p>
                  <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                    ${Number(item.price).toLocaleString("es-CL")} × {item.quantity}
                  </p>
                </div>
                <span style={{ fontSize:"13px", fontWeight:500, flexShrink:0, marginLeft:"12px" }}>
                  ${Number(item.subtotal).toLocaleString("es-CL")}
                </span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between",
              padding:"13px 16px", borderTop:"1px solid var(--border)",
              background:"var(--surface-3)" }}>
              <span style={{ fontSize:"14px", fontWeight:500 }}>Total</span>
              <span style={{ fontFamily:"var(--font-serif)", fontSize:"1.4rem",
                color:"var(--accent)" }}>
                ${Number(order.total).toLocaleString("es-CL")}
              </span>
            </div>
          </div>

          {/* Pagos */}
          {order.payments?.length > 0 && (
            <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)",
              borderRadius:"var(--r-xl)", overflow:"hidden" }}>
              <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
                letterSpacing:"0.08em", padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
                Pagos
              </p>
              {order.payments.map((p, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:"11px 16px",
                  borderBottom: i < order.payments.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div>
                    <p style={{ fontSize:"12px", fontWeight:500 }}>{p.provider}</p>
                    <p style={{ fontSize:"11px", color:"var(--text-3)" }}>{p.paid_at || p.created_at}</p>
                  </div>
                  <Badge status={p.status} />
                </div>
              ))}
            </div>
          )}

          {/* Documentos tributarios */}
          {["paid","shipped","completed"].includes(order.status) && (
            <div style={{ paddingTop:"4px" }}>
              <p style={{ fontSize:"12px", color:"var(--text-3)", marginBottom:"10px" }}>
                Documentos tributarios
              </p>
              {docResult ? (
                <button onClick={() => handleDownload(docResult.id, docResult.folio)}
                  className="btn btn-accent"
                  style={{ width:"100%", justifyContent:"center", fontSize:"13px" }}>
                  ⬇️ {docResult.folio} — Descargar PDF
                </button>
              ) : (
                <div style={{ display:"flex", gap:"8px" }}>
                  {["boleta","factura"].map(tipo => (
                    <button key={tipo} onClick={() => docMutation.mutate(tipo)}
                      disabled={docMutation.isPending}
                      style={{ flex:1, padding:"10px", borderRadius:"var(--r-lg)",
                        background:"var(--surface-3)", border:"1px solid var(--border)",
                        color:"var(--text-2)", fontSize:"13px", cursor:"pointer",
                        textTransform:"capitalize",
                        opacity: docMutation.isPending ? 0.5 : 1 }}>
                      {docMutation.isPending ? "..." : `🧾 ${tipo}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function AdminOrders() {
  const [statusFilter,  setStatusFilter]  = useState("")
  const [search,        setSearch]        = useState("")
  const [selectedOrder, setSelectedOrder] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", statusFilter, search],
    queryFn:  () => getAdminOrders({
      ...(statusFilter && { status: statusFilter }),
      ...(search       && { search }),
    }),
  })

  const orders = data?.results || []

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {selectedOrder && (
        <OrderPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end",
        marginBottom:"28px", flexWrap:"wrap", gap:"16px" }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>Órdenes</h1>
          <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
            {data?.count || 0} pedidos totales
          </p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por email o ID..."
          style={{ padding:"9px 16px", fontSize:"13px", outline:"none",
            background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"var(--r-full)", color:"var(--text)", width:"260px",
            transition:"border-color var(--dur)" }}
          onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"} />
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"20px", flexWrap:"wrap" }}>
        {[["","Todos"],["pending","Pendiente"],["paid","Pagado"],
          ["shipped","Enviado"],["completed","Completado"],["cancelled","Cancelado"]
        ].map(([s, label]) => (
          <button key={s} type="button" onClick={() => setStatusFilter(s)} style={{
            padding:"6px 16px", borderRadius:"var(--r-full)", fontSize:"12px", cursor:"pointer",
            background: statusFilter === s ? "var(--text)" : "transparent",
            color:      statusFilter === s ? "var(--bg)"   : "var(--text-3)",
            border:     `1px solid ${statusFilter === s ? "var(--text)" : "var(--border)"}`,
            fontWeight: statusFilter === s ? 500 : 400,
            transition:"all var(--dur) var(--ease)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {[...Array(7)].map((_,i) => <div key={i} className="skeleton" style={{ height:"56px" }} />)}
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
          color:"var(--text-3)", fontSize:"14px" }}>
          <p style={{ fontSize:"36px", marginBottom:"12px" }}>📭</p>
          No hay órdenes con este filtro.
        </div>
      ) : (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 2fr 1.2fr 1fr 1fr",
            padding:"10px 20px", borderBottom:"1px solid var(--border)",
            fontSize:"11px", fontWeight:500, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.08em" }}>
            <span>ID</span><span>Email</span>
            <span>Total</span><span>Estado</span><span>Fecha</span>
          </div>

          {orders.map((order, i) => (
            <div key={order.id}
              onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
              style={{ display:"grid", gridTemplateColumns:"1.2fr 2fr 1.2fr 1fr 1fr",
                padding:"14px 20px", alignItems:"center", gap:"8px",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                cursor:"pointer", transition:"background var(--dur) var(--ease)",
                background: selectedOrder?.id === order.id ? "rgba(26,255,110,0.03)" : "transparent" }}
              onMouseEnter={e => { if (selectedOrder?.id !== order.id) e.currentTarget.style.background = "var(--surface-2)" }}
              onMouseLeave={e => { if (selectedOrder?.id !== order.id) e.currentTarget.style.background = "transparent" }}>
              <span style={{ fontSize:"12px", fontFamily:"monospace", color:"var(--text-2)", fontWeight:500 }}>
                #{order.id.slice(0,8).toUpperCase()}
              </span>
              <span style={{ fontSize:"13px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {order.email}
              </span>
              <span style={{ fontSize:"13px", fontWeight:500 }}>
                ${Number(order.total).toLocaleString("es-CL")}
              </span>
              <Badge status={order.status} />
              <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
                {new Date(order.created_at).toLocaleDateString("es-CL", {
                  day:"numeric", month:"short", year:"2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
