// pages/admin/AdminPayments.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminPayments, updatePaymentStatus } from "../../api/admin.api"
import { StatCard, DataTable, StatusBadge, AdminPageHeader } from "../../components/admin/ui"
import { Inbox } from "lucide-react"

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
  })
  return (
    <select value={current}
      onChange={e => {
        const v = e.target.value
        if (["rejected","cancelled","refunded"].includes(v)) {
          if (!window.confirm(`¿Cambiar a "${STATUS[v]?.label}"? Esto afecta finanzas.`)) return
        }
        mutation.mutate(v)
      }}
      disabled={mutation.isPending}
      onClick={e => e.stopPropagation()}
      style={{ padding:"6px 10px", borderRadius:"var(--r-md)", fontSize:"12px",
        background:"var(--surface-3)", border:"1px solid var(--border)", color:"var(--text)",
        cursor:"pointer", outline:"none", minWidth:"130px",
        opacity: mutation.isPending ? 0.5 : 1 }}>
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

  const columns = [
    { key:"order_id", header:"Orden", sortable:true,
      render:p => <span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12.5 }}>#{p.order_id?.slice(0,8).toUpperCase()}</span> },
    { key:"order_email", header:"Email", sortable:true,
      render:p => <span style={{ color:"var(--admin-text-muted)" }}>{p.order_email}</span> },
    { key:"provider", header:"Método",
      render:p => <span style={{ color:"var(--admin-text-muted)" }}>{PROVIDERS[p.provider] || p.provider}</span> },
    { key:"amount", header:"Monto", sortable:true, align:"right",
      render:p => <span style={{ fontWeight:700, color:"var(--admin-primary-text)" }}>${Number(p.amount).toLocaleString("es-CL")}</span> },
    { key:"status", header:"Estado",
      render:p => <StatusBadge tone={TONE[p.status] || "neutral"}>{STATUS[p.status]?.label || p.status}</StatusBadge> },
    { header:"Cambiar estado",
      render:p => <StatusSelector paymentId={p.id} current={p.status} /> },
  ]

  return (
    <div className="au-page" style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      <AdminPageHeader eyebrow="Ventas" title="Pagos"
        description={data?.total_approved > 0
          ? `Total aprobado: $${Number(data.total_approved).toLocaleString("es-CL")}`
          : undefined} />

      {/* KPIs rápidos por estado */}
      <div className="au-grid" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))" }}>
        {Object.entries(STATUS).map(([s, { label }]) => {
          const count = payments.filter(p => p.status === s).length
          const active = statusFilter === s
          return (
            <StatCard key={s} variant="compact" label={label} value={count}
              onClick={() => setStatusFilter(active ? "" : s)}
              badge={active ? <span className="au-lp__delta au-lp__delta--pos">activo</span> : null}
              testId={`payment-kpi-${s}`} />
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
