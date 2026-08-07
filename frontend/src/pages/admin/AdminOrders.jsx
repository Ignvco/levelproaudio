// pages/admin/AdminOrders.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminOrders, updateOrderStatus, updateOrderShipping,
  generateDocumentFromOrder, downloadDocument,
} from "../../api/admin.api"
import { Eye, Inbox, Truck } from "lucide-react"
import { DataTable, StatusBadge, AdminPageHeader, formInputStyle } from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"

const STATUS = {
  pending:   { label:"Pendiente",  color:"#D97706" },
  paid:      { label:"Pagado",     color:"#0F9940" },
  shipped:   { label:"Enviado",    color:"#60a5fa" },
  completed: { label:"Completado", color:"#0F9940" },
  cancelled: { label:"Cancelado",  color:"#EF4444" },
}

const TONE = { pending:"warning", paid:"success", shipped:"info", completed:"success", cancelled:"danger", approved:"success", rejected:"danger", refunded:"info" }

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
  const [carrier, setCarrier]   = useState(order.shipping_carrier || "")
  const [tracking, setTracking] = useState(order.tracking_number || "")

  const shippingMutation = useMutation({
    mutationFn: () => updateOrderShipping(order.id, {
      shipping_carrier: carrier, tracking_number: tracking,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-orders"])
    },
    onError: (e) => {
      showToast(e?.response?.data?.detail || "No se pudo guardar el envío.", "error")
    },
  })
  const shippingDirty = carrier !== (order.shipping_carrier || "") || tracking !== (order.tracking_number || "")

  const statusMutation = useMutation({
    mutationFn: (s) => updateOrderStatus(order.id, s),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-orders"])
      queryClient.invalidateQueries(["admin-dashboard"])
      queryClient.invalidateQueries(["admin-payments"])
      queryClient.invalidateQueries(["admin-finance-summary"])
    },
    onError: (e) => {
      showToast(e?.response?.data?.detail || "No se pudo actualizar el estado de la orden.", "error")
    },
  })

  const docMutation = useMutation({
    mutationFn: (tipo) => generateDocumentFromOrder(order.id, tipo),
    onSuccess:  (data) => setDocResult(data),
    onError:    (e)    => showToast(e?.response?.data?.error || "Error al generar.", "error"),
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
              <p style={{ fontSize:"12px", color:"var(--accent-text)", marginTop:"8px" }}>
                ✓ Estado actualizado
              </p>
            )}
          </div>

          {/* Envío */}
          <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", padding:"18px" }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:"12px", display:"flex", alignItems:"center", gap:"6px" }}>
              <Truck size={13} /> Envío
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div>
                <label style={{ display:"block", fontSize:"11px", color:"var(--text-3)", marginBottom:"5px" }}>
                  Transportista
                </label>
                <input value={carrier} onChange={e => setCarrier(e.target.value)}
                  placeholder="Ej: Chilexpress, Starken..."
                  style={{ ...formInputStyle, fontSize:"13px", padding:"9px 12px" }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:"11px", color:"var(--text-3)", marginBottom:"5px" }}>
                  Número de seguimiento
                </label>
                <input value={tracking} onChange={e => setTracking(e.target.value)}
                  placeholder="Ej: CL123456789"
                  style={{ ...formInputStyle, fontSize:"13px", padding:"9px 12px" }} />
              </div>
              {shippingDirty && (
                <button onClick={() => shippingMutation.mutate()} disabled={shippingMutation.isPending}
                  className="btn btn-accent" style={{ padding:"8px 16px", fontSize:"12px" }}>
                  {shippingMutation.isPending ? "Guardando..." : "Guardar envío"}
                </button>
              )}
              {shippingMutation.isSuccess && !shippingDirty && (
                <p style={{ fontSize:"12px", color:"var(--accent-text)" }}>✓ Envío actualizado</p>
              )}
            </div>
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
              <div key={item.id || `item-${i}`} style={{ display:"flex", justifyContent:"space-between",
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
              <span style={{ fontFamily:"var(--font-display)", fontSize:"1.4rem",
                color:"var(--accent-text)" }}>
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
                <div key={p.id || `pay-${i}`} style={{ display:"flex", justifyContent:"space-between",
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
  const [selectedOrder, setSelectedOrder] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", statusFilter],
    queryFn:  () => getAdminOrders({ ...(statusFilter && { status: statusFilter }) }),
  })

  const orders = data?.results || []

  const columns = [
    { key:"id", header:"Orden", sortable:true,
      render:o => <span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12.5 }}>#{o.id.slice(0,8).toUpperCase()}</span> },
    { key:"email", header:"Cliente", sortable:true,
      render:o => <span style={{ color:"var(--admin-text-muted)" }}>{o.email}</span> },
    { key:"total", header:"Total", sortable:true, align:"right",
      render:o => <span style={{ fontWeight:700, color:"var(--admin-primary-text)" }}>${Number(o.total).toLocaleString("es-CL")}</span> },
    { key:"status", header:"Estado",
      render:o => <StatusBadge tone={TONE[o.status] || "neutral"}>{STATUS[o.status]?.label || o.status}</StatusBadge> },
    { key:"created_at", header:"Fecha", sortable:true,
      render:o => <span style={{ color:"var(--admin-text-muted)" }}>{new Date(o.created_at).toLocaleDateString("es-CL", { day:"numeric", month:"short", year:"2-digit" })}</span> },
  ]

  return (
    <div className="au-page" style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {selectedOrder && (
        <OrderPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      <AdminPageHeader eyebrow="Ventas" title="Órdenes"
        description={`${data?.count || 0} pedidos totales`} />

      <DataTable
        columns={columns} data={orders} loading={isLoading}
        getRowId={o => o.id}
        searchable searchKeys={["email", "id"]} searchPlaceholder="Buscar por email o ID..."
        filters={[{
          label:"Estado", value:statusFilter, onChange:setStatusFilter,
          options:[{ value:"", label:"Todos los estados" },
            ...Object.entries(STATUS).map(([v, { label }]) => ({ value:v, label }))],
        }]}
        onRowClick={o => setSelectedOrder(o)}
        rowActions={o => [{ label:"Ver detalle", icon:Eye, onClick:() => setSelectedOrder(o) }]}
        emptyIcon={Inbox} emptyTitle="No hay órdenes" emptyDesc="No hay pedidos con este filtro."
        testId="orders-table" />

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
