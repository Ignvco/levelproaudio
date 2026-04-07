// pages/admin/AdminPayments.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminPayments, updatePaymentStatus } from "../../api/admin.api"

const STATUS = {
  pending:   { label:"Pendiente",   color:"#facc15" },
  approved:  { label:"Aprobado",    color:"#4ade80" },
  rejected:  { label:"Rechazado",   color:"#f87171" },
  cancelled: { label:"Cancelado",   color:"#888888" },
  refunded:  { label:"Reembolsado", color:"#60a5fa" },
}

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

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ marginBottom:"28px" }}>
        <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.4rem)",
          fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>Pagos</h1>
        {data?.total_approved > 0 && (
          <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
            Total aprobado:{" "}
            <span style={{ color:"var(--accent)", fontWeight:600 }}>
              ${Number(data.total_approved).toLocaleString("es-CL")}
            </span>
          </p>
        )}
      </div>

      {/* KPIs rápidos por estado */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",
        gap:"10px", marginBottom:"24px" }}>
        {Object.entries(STATUS).map(([s, { label, color }]) => {
          const count = payments.filter(p => p.status === s).length
          return (
            <button key={s} type="button"
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              style={{ padding:"14px 16px", borderRadius:"var(--r-xl)", textAlign:"left",
                cursor:"pointer", transition:"all var(--dur) var(--ease)",
                background: statusFilter === s ? `${color}10` : "var(--surface)",
                border:     `1px solid ${statusFilter === s ? color+"40" : "var(--border)"}` }}>
              <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
                letterSpacing:"0.06em", marginBottom:"6px" }}>{label}</p>
              <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.6rem",
                color, lineHeight:1 }}>{count}</p>
            </button>
          )
        })}
      </div>

      {/* Filtros pills */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"20px", flexWrap:"wrap" }}>
        {[["","Todos"], ...Object.entries(STATUS).map(([s,{label}]) => [s,label])].map(
          ([s, label]) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)} style={{
              padding:"6px 14px", borderRadius:"var(--r-full)", fontSize:"12px", cursor:"pointer",
              background: statusFilter === s ? "var(--text)" : "transparent",
              color:      statusFilter === s ? "var(--bg)"   : "var(--text-3)",
              border:     `1px solid ${statusFilter === s ? "var(--text)" : "var(--border)"}`,
              fontWeight: statusFilter === s ? 500 : 400,
              transition:"all var(--dur) var(--ease)" }}>
              {label}
            </button>
          )
        )}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {[...Array(6)].map((_,i) => <div key={i} className="skeleton" style={{ height:"52px" }} />)}
        </div>
      ) : payments.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
          color:"var(--text-3)" }}>
          <p style={{ fontSize:"36px", marginBottom:"12px" }}>💳</p>
          <p style={{ fontSize:"14px" }}>No hay pagos con este filtro.</p>
        </div>
      ) : (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>

          <div style={{ display:"grid",
            gridTemplateColumns:"1fr 2fr 1fr 1.2fr 1fr 1.4fr",
            padding:"10px 20px", borderBottom:"1px solid var(--border)",
            fontSize:"11px", fontWeight:500, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.08em" }}>
            <span>Orden</span><span>Email</span><span>Método</span>
            <span>Monto</span><span>Estado</span><span>Cambiar</span>
          </div>

          {payments.map((p, i) => (
            <div key={p.id} style={{ display:"grid",
              gridTemplateColumns:"1fr 2fr 1fr 1.2fr 1fr 1.4fr",
              padding:"13px 20px", alignItems:"center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              gap:"8px", transition:"background var(--dur) var(--ease)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize:"12px", fontFamily:"monospace",
                color:"var(--text-2)", fontWeight:500 }}>
                #{p.order_id?.slice(0,8).toUpperCase()}
              </span>
              <span style={{ fontSize:"13px", overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {p.order_email}
              </span>
              <span style={{ fontSize:"12px", color:"var(--text-2)" }}>
                {PROVIDERS[p.provider] || p.provider}
              </span>
              <span style={{ fontSize:"13px", fontWeight:600, color:"var(--accent)" }}>
                ${Number(p.amount).toLocaleString("es-CL")}
              </span>
              <Badge status={p.status} />
              <StatusSelector paymentId={p.id} current={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
