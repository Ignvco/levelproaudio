// pages/admin/AdminPayments.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminPayments, updatePaymentStatus } from "../../api/admin.api"
import { StatCard, DataTable, StatusBadge, AdminPageHeader, SecondaryButton } from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { Inbox, Bell } from "lucide-react"

const STATUS = {
  pending:   { label:"Pendiente",   color:"#D97706" },
  approved:  { label:"Aprobado",    color:"#0F9940" },
  rejected:  { label:"Rechazado",   color:"#EF4444" },
  cancelled: { label:"Cancelado",   color:"#888888" },
  refunded:  { label:"Reembolsado", color:"#60a5fa" },
}

const TONE = { pending:"warning", approved:"success", rejected:"danger", cancelled:"neutral", refunded:"info" }

const PROVIDERS = {
  mercadopago_cl: "MP Chile", mercadopago_ar: "MP Argentina",
  paypal:"PayPal", global66:"Global66", transfer:"Transferencia", cash:"Manual",
}

function StatusSelector({ paymentId, current }) {
  const queryClient = useQueryClient()
  const mutation    = useMutation({
    mutationFn: (s) => updatePaymentStatus(paymentId, s),
    onSuccess:  () => {
      queryClient.invalidateQueries(["admin-payments"])
      queryClient.invalidateQueries(["admin-orders"])
      queryClient.invalidateQueries(["admin-dashboard"])
      queryClient.invalidateQueries(["admin-finance-summary"])
    },
    onError: (e) => {
      showToast(e?.response?.data?.detail || "No se pudo actualizar el estado del pago. Verificá antes de asumir que se marcó.", "error")
    },
  })
  return (
    <select value={current}
      className="au-select"
      onChange={e => {
        const v = e.target.value
        if (["rejected","cancelled","refunded"].includes(v)) {
          if (!window.confirm(`¿Cambiar a "${STATUS[v]?.label}"? Esto afecta finanzas.`)) return
        }
        mutation.mutate(v)
      }}
      disabled={mutation.isPending}
      onClick={e => e.stopPropagation()}
      style={{ minWidth:"135px", opacity: mutation.isPending ? 0.5 : 1 }}>
      {Object.entries(STATUS).map(([v,{label}]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
}

export default function AdminPayments() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", statusFilter],
    queryFn:  () => getAdminPayments(statusFilter ? { status:statusFilter } : {}),
  })
  const payments = data?.results || []

  const pendingTransfers = payments.filter(
    p => p.status === "pending" && (p.provider === "transfer" || p.provider === "global66")
  )

  const columns = [
    { key:"order_id", header:"Orden", sortable:true,
      render:p => <span style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:12.5, color:"var(--admin-text)" }}>#{p.order_id?.slice(0,8).toUpperCase()}</span> },
    { key:"order_email", header:"Email", sortable:true,
      render:p => <span style={{ color:"var(--admin-text-muted)" }}>{p.order_email}</span> },
    { key:"provider", header:"Método",
      render:p => <span style={{ color:"var(--admin-text-muted)" }}>{PROVIDERS[p.provider] || p.provider}</span> },
    { key:"amount", header:"Monto", sortable:true, align:"right",
      render:p => <span style={{ fontWeight:700, color:"var(--admin-primary-text)" }}>${Number(p.amount).toLocaleString("es-CL")}</span> },
    { key:"status", header:"Estado",
      render:p => {
        const isPendingTransfer = p.status === "pending" &&
          (p.provider === "transfer" || p.provider === "global66")
        return (
          <span style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>
            <StatusBadge tone={TONE[p.status] || "neutral"}>{STATUS[p.status]?.label || p.status}</StatusBadge>
            {isPendingTransfer && (
              <span title="Transferencia esperando tu aprobación"
                style={{
                  display:"inline-flex", alignItems:"center", gap:"3px",
                  fontSize:"10.5px", fontWeight:700, color:"#D97706",
                  padding:"2px 8px", borderRadius:"9999px",
                  background:"rgba(217,119,6,0.12)", border:"1px solid rgba(217,119,6,0.3)",
                  whiteSpace:"nowrap",
                }}>
                ● revisá
              </span>
            )}
          </span>
        )
      } },
    { header:"Cambiar estado",
      render:p => <StatusSelector paymentId={p.id} current={p.status} /> },
  ]

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / VENTAS"
        title="Pagos"
        description={data?.total_approved > 0
          ? `Total aprobado: $${Number(data.total_approved).toLocaleString("es-CL")}`
          : "Conciliación de transacciones, pasarelas y transferencias"}
        actions={<SecondaryButton to="/admin/payment-methods" size="sm">Métodos de pago</SecondaryButton>}
      />

      {pendingTransfers.length > 0 && (
        <div
          onClick={() => setStatusFilter("pending")}
          className="lp-callout lp-callout--warning"
          style={{ cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"14px", flex:1, minWidth:0 }}>
            <span className="lp-alert-icon"><Bell size={18} /></span>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"14px", fontWeight:700, color:"var(--admin-text)" }}>
                {pendingTransfers.length} transferencia{pendingTransfers.length !== 1 ? "s" : ""} esperando tu aprobación
              </p>
              <p style={{ fontSize:"12.5px", color:"var(--admin-text-muted)" }}>
                Revisá que el comprobante haya llegado y aprobá el pago para procesar el pedido.
              </p>
            </div>
          </div>
          <span style={{ fontSize:"12px", fontWeight:700, color:"#D97706", whiteSpace:"nowrap" }}>
            Ver pendientes →
          </span>
        </div>
      )}

      {/* KPIs rápidos por estado */}
      <div className="au-grid" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(175px, 1fr))" }}>
        {Object.entries(STATUS).map(([s, { label }]) => {
          const count = payments.filter(p => p.status === s).length
          const active = statusFilter === s
          return (
            <StatCard
              key={s}
              variant={active ? "primary" : s === "approved" ? "ink" : "light"}
              size="compact"
              label={label}
              value={count}
              onClick={() => setStatusFilter(active ? "" : s)}
              badge={active ? <span className="au-lp__delta au-lp__delta--pos">activo</span> : null}
              testId={`payment-kpi-${s}`}
            />
          )
        })}
      </div>

      <DataTable
        columns={columns} data={payments} loading={isLoading}
        getRowId={p => p.id}
        searchable searchKeys={["order_email", "order_id"]} searchPlaceholder="Buscar por email u orden..."
        filters={[{
          label:"Estado", value:statusFilter, onChange:setStatusFilter,
          options:[{ value:"", label:"Todos los estados" },
            ...Object.entries(STATUS).map(([v, { label }]) => ({ value:v, label }))],
        }]}
        emptyIcon={Inbox} emptyTitle="No hay pagos" emptyDesc="No hay pagos con este filtro."
        testId="payments-table" />
    </div>
  )
}
