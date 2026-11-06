// pages/admin/AdminOrders.jsx
import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminOrders, updateOrderStatus, updateOrderShipping,
} from "../../api/admin.api"
import { Eye, Inbox, Truck, FileText, ShoppingBag, CheckCircle2, Clock3, PackageCheck, X } from "lucide-react"
import {
  DataTable, StatusBadge, AdminPageHeader, StatCard,
  PrimaryButton, SecondaryButton, formInputStyle,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { formatCurrency } from "../../utils/accountingCurrency"

const STATUS = {
  pending:   { label:"Pendiente",  color:"#D97706" },
  paid:      { label:"Pagado",     color:"#0F9940" },
  shipped:   { label:"Enviado",    color:"#60a5fa" },
  completed: { label:"Completado", color:"#0F9940" },
  cancelled: { label:"Cancelado",  color:"#EF4444" },
}

const TONE = {
  pending:"warning", paid:"success", shipped:"info", completed:"success",
  cancelled:"danger", approved:"success", rejected:"danger", refunded:"info",
}

function OrderPanel({ order, onClose }) {
  const queryClient      = useQueryClient()
  const [carrier, setCarrier]   = useState(order.shipping_carrier || "")
  const [tracking, setTracking] = useState(order.tracking_number || "")

  const shippingMutation = useMutation({
    mutationFn: () => updateOrderShipping(order.id, {
      shipping_carrier: carrier, tracking_number: tracking,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
    },
    onError: (e) => {
      showToast(e?.response?.data?.detail || "No se pudo guardar el envío.", "error")
    },
  })
  const shippingDirty = carrier !== (order.shipping_carrier || "") || tracking !== (order.tracking_number || "")

  const statusMutation = useMutation({
    mutationFn: (s) => updateOrderStatus(order.id, s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] })
      queryClient.invalidateQueries({ queryKey: ["admin-finance-summary"] })
    },
    onError: (e) => {
      showToast(e?.response?.data?.detail || "No se pudo actualizar el estado de la orden.", "error")
    },
  })

  return (
    <>
      <div onClick={onClose} className="lp-drawer-backdrop" />

      <div className="lp-drawer" role="dialog" aria-modal="true" aria-label="Detalle de orden">
        {/* Header */}
        <div style={{
          padding:"20px 24px", borderBottom:"1px solid var(--admin-border)",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background:"var(--admin-surface-secondary)", flexShrink:0,
        }}>
          <div>
            <p className="au-eyebrow" style={{ marginBottom:"4px" }}>Orden de compra</p>
            <p style={{ fontSize:"17px", fontWeight:800, fontFamily:"var(--font-mono)", color:"var(--admin-text)" }}>
              #{order.id.slice(0,8).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="au-iconbtn" aria-label="Cerrar panel">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex:1, overflowY:"auto", padding:"20px 24px",
          display:"flex", flexDirection:"column", gap:"16px",
        }}>

          {/* Estado */}
          <div style={{
            background:"var(--admin-surface-secondary)", border:"1px solid var(--admin-border)",
            borderRadius:"18px", padding:"18px",
          }}>
            <p style={{
              fontSize:"11px", color:"var(--admin-text-muted)", textTransform:"uppercase",
              letterSpacing:"0.08em", fontWeight:700, marginBottom:"12px",
            }}>Estado</p>
            <div style={{
              display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:"14px",
            }}>
              <StatusBadge tone={TONE[order.status] || "neutral"}>
                {STATUS[order.status]?.label || order.status}
              </StatusBadge>
              <span style={{ fontSize:"12px", color:"var(--admin-text-muted)" }}>
                {new Date(order.created_at).toLocaleDateString("es-CL", {
                  day:"numeric", month:"long", year:"numeric",
                })}
              </span>
            </div>
            <p style={{ fontSize:"11.5px", color:"var(--admin-text-muted)", marginBottom:"8px" }}>
              Cambiar a:
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
              {Object.entries(STATUS)
                .filter(([s]) => s !== order.status)
                .map(([s, { label, color }]) => (
                  <button key={s} onClick={() => statusMutation.mutate(s)}
                    disabled={statusMutation.isPending}
                    style={{
                      padding:"6px 12px", borderRadius:"9999px",
                      fontSize:"12px", fontWeight:600, cursor:"pointer",
                      color, background:`${color}12`, border:`1px solid ${color}30`,
                      transition:"all var(--dur) var(--ease)",
                      opacity: statusMutation.isPending ? 0.5 : 1,
                    }}>
                    → {label}
                  </button>
                ))}
            </div>
            {statusMutation.isSuccess && (
              <p style={{ fontSize:"12px", color:"var(--admin-primary-text)", fontWeight:600, marginTop:"8px" }}>
                ✓ Estado actualizado
              </p>
            )}
          </div>

          {/* Envío */}
          <div style={{
            background:"var(--admin-surface-secondary)", border:"1px solid var(--admin-border)",
            borderRadius:"18px", padding:"18px",
          }}>
            <p style={{
              fontSize:"11px", color:"var(--admin-text-muted)", textTransform:"uppercase",
              letterSpacing:"0.08em", fontWeight:700, marginBottom:"12px",
              display:"flex", alignItems:"center", gap:"6px",
            }}>
              <Truck size={13} /> Envío
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div>
                <label style={{ display:"block", fontSize:"11.5px", color:"var(--admin-text-muted)", fontWeight:600, marginBottom:"5px" }}>
                  Transportista
                </label>
                <input value={carrier} onChange={e => setCarrier(e.target.value)}
                  placeholder="Ej: Chilexpress, Starken..."
                  style={{ ...formInputStyle, background:"#fff", fontSize:"13px", padding:"9px 12px" }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:"11.5px", color:"var(--admin-text-muted)", fontWeight:600, marginBottom:"5px" }}>
                  Número de seguimiento
                </label>
                <input value={tracking} onChange={e => setTracking(e.target.value)}
                  placeholder="Ej: CL123456789"
                  style={{ ...formInputStyle, background:"#fff", fontSize:"13px", padding:"9px 12px" }} />
              </div>
              {shippingDirty && (
                <PrimaryButton size="sm" onClick={() => shippingMutation.mutate()} disabled={shippingMutation.isPending}>
                  {shippingMutation.isPending ? "Guardando..." : "Guardar envío"}
                </PrimaryButton>
              )}
              {shippingMutation.isSuccess && !shippingDirty && (
                <p style={{ fontSize:"12px", color:"var(--admin-primary-text)", fontWeight:600 }}>✓ Envío actualizado</p>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div style={{
            background:"var(--admin-surface-secondary)", border:"1px solid var(--admin-border)",
            borderRadius:"18px", padding:"18px",
          }}>
            <p style={{
              fontSize:"11px", color:"var(--admin-text-muted)", textTransform:"uppercase",
              letterSpacing:"0.08em", fontWeight:700, marginBottom:"12px",
            }}>Cliente</p>
            {[
              { label:"Email",     value: order.email },
              { label:"Dirección", value: order.shipping_address || "—" },
              ...(order.notes ? [{ label:"Notas", value: order.notes }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display:"flex", gap:"12px", fontSize:"13px", marginBottom:"8px" }}>
                <span style={{ color:"var(--admin-text-muted)", flexShrink:0, minWidth:"72px" }}>
                  {label}
                </span>
                <span style={{ color:"var(--admin-text)", fontWeight:500, wordBreak:"break-word" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Productos */}
          <div style={{
            background:"#fff", border:"1px solid var(--admin-border)",
            borderRadius:"18px", overflow:"hidden",
          }}>
            <p style={{
              fontSize:"11px", color:"var(--admin-text-muted)", textTransform:"uppercase",
              letterSpacing:"0.08em", fontWeight:700, padding:"12px 16px",
              borderBottom:"1px solid var(--admin-border)", background:"var(--admin-surface-secondary)",
            }}>
              Productos ({order.items_count})
            </p>
            {order.items?.map((item, i) => (
              <div key={item.id || `item-${i}`} style={{
                display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"11px 16px",
                borderBottom: i < order.items.length - 1 ? "1px solid var(--admin-border)" : "none",
              }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <p style={{
                    fontSize:"13px", fontWeight:600, color:"var(--admin-text)", overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>
                    {item.product_name}
                  </p>
                  <p style={{ fontSize:"11.5px", color:"var(--admin-text-muted)" }}>
                    {formatCurrency(item.price, order.currency)} × {item.quantity}
                  </p>
                </div>
                <span style={{ fontSize:"13px", fontWeight:700, color:"var(--admin-text)", flexShrink:0, marginLeft:"12px" }}>
                  {formatCurrency(item.subtotal, order.currency)}
                </span>
              </div>
            ))}
            <div style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"13px 16px", borderTop:"1px solid var(--admin-border)",
              background:"var(--admin-surface-secondary)",
            }}>
              <span style={{ fontSize:"13.5px", fontWeight:700, color:"var(--admin-text)" }}>Total</span>
              <span style={{
                fontFamily:"var(--font-display)", fontSize:"1.35rem", fontWeight:800,
                color:"var(--admin-primary-text)",
              }}>
                {formatCurrency(order.total, order.currency)}
              </span>
            </div>
          </div>

          {/* Pagos */}
          {order.payments?.length > 0 && (
            <div style={{
              background:"#fff", border:"1px solid var(--admin-border)",
              borderRadius:"18px", overflow:"hidden",
            }}>
              <p style={{
                fontSize:"11px", color:"var(--admin-text-muted)", textTransform:"uppercase",
                letterSpacing:"0.08em", fontWeight:700, padding:"12px 16px",
                borderBottom:"1px solid var(--admin-border)", background:"var(--admin-surface-secondary)",
              }}>
                Pagos
              </p>
              {order.payments.map((p, i) => (
                <div key={p.id || `pay-${i}`} style={{
                  display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:"11px 16px",
                  borderBottom: i < order.payments.length - 1 ? "1px solid var(--admin-border)" : "none",
                }}>
                  <div>
                    <p style={{ fontSize:"12.5px", fontWeight:600, color:"var(--admin-text)" }}>{p.provider}</p>
                    <p style={{ fontSize:"11px", color:"var(--admin-text-muted)" }}>{p.paid_at || p.created_at}</p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span>{formatCurrency(p.amount, p.currency)}</span><StatusBadge tone={TONE[p.status] || "neutral"}>{p.status}</StatusBadge></span>
                </div>
              ))}
            </div>
          )}

          {/* Documentación tributaria */}
          {["paid","shipped","completed"].includes(order.status) && (
            <div style={{ paddingTop:"4px" }}>
              <p style={{ fontSize:"11.5px", color:"var(--admin-text-muted)", fontWeight:600, marginBottom:"8px" }}>
                Documentación tributaria
              </p>
              <Link to="/admin/billing" className="au-btn au-btn--secondary" style={{ width:"100%", textDecoration:"none" }}>
                <FileText size={14} /> Registrar / gestionar en Documentación Tributaria
              </Link>
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
  const totalCount = data?.count ?? orders.length
  const paidCount = orders.filter(o => o.status === "paid" || o.status === "completed").length
  const pendingCount = orders.filter(o => o.status === "pending").length
  const shippedCount = orders.filter(o => o.status === "shipped").length

  const columns = [
    { key:"id", header:"Orden", sortable:true,
      render:o => <span style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:12.5, color:"var(--admin-text)" }}>#{o.id.slice(0,8).toUpperCase()}</span> },
    { key:"email", header:"Cliente", sortable:true,
      render:o => <span style={{ color:"var(--admin-text-muted)" }}>{o.email}</span> },
    { key:"total", header:"Total", sortable:true, align:"right",
      render:o => <span style={{ fontWeight:700, color:"var(--admin-primary-text)" }}>{formatCurrency(o.total, o.currency)}</span> },
    { key:"status", header:"Estado",
      render:o => <StatusBadge tone={TONE[o.status] || "neutral"}>{STATUS[o.status]?.label || o.status}</StatusBadge> },
    { key:"created_at", header:"Fecha", sortable:true,
      render:o => {
        const raw = o.created_at || o.created
        if (!raw) return <span style={{ color:"var(--admin-text-muted)" }}>—</span>
        const d = new Date(raw)
        const formatted = Number.isNaN(d.getTime())
          ? String(raw)
          : d.toLocaleDateString("es-CL", { day:"numeric", month:"short", year:"2-digit" })
        return <span style={{ color:"var(--admin-text-muted)" }}>{formatted}</span>
      } },
  ]

  return (
    <div className="au-page">
      {selectedOrder && (
        <OrderPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      <AdminPageHeader
        eyebrow="LEVELPRO / VENTAS"
        title="Órdenes"
        description={`${totalCount} pedidos registrados en el sistema`}
        actions={
          <>
            <SecondaryButton to="/admin/special-orders" size="sm">Bajo pedido</SecondaryButton>
            <SecondaryButton to="/admin/payments" size="sm">Pagos</SecondaryButton>
            <SecondaryButton to="/admin/billing" size="sm">Tributario</SecondaryButton>
          </>
        }
      />

      <div className="lp-grid-kpi">
        <StatCard
          variant="ink"
          label="Total pedidos"
          value={totalCount}
          sub="Filtro actual"
          Icon={ShoppingBag}
          onClick={() => setStatusFilter("")}
        />
        <StatCard
          variant="primary"
          label="Pagados / Completados"
          value={paidCount}
          sub="En vista actual"
          Icon={CheckCircle2}
          onClick={() => setStatusFilter(statusFilter === "paid" ? "" : "paid")}
        />
        <StatCard
          variant="light"
          label="Pendientes"
          value={pendingCount}
          sub={pendingCount > 0 ? "Por confirmar" : "Al día"}
          Icon={Clock3}
          onClick={() => setStatusFilter(statusFilter === "pending" ? "" : "pending")}
        />
        <StatCard
          variant="light"
          label="En tránsito"
          value={shippedCount}
          sub="Despachados"
          Icon={PackageCheck}
          onClick={() => setStatusFilter(statusFilter === "shipped" ? "" : "shipped")}
        />
      </div>

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
    </div>
  )
}
