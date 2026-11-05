// pages/admin/AdminSpecialOrders.jsx — Gestión de solicitudes bajo pedido
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listSpecialOrders, updateSpecialOrder, deleteSpecialOrder } from "../../api/admin.api"
import {
  AdminPageHeader, StatusBadge, FormModal, FormField, formInputStyle,
  ConfirmationModal, EmptyState, StatCard, IconButton, SecondaryButton,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { PackageSearch, Pencil, Trash2, Clock3, CheckCircle2, Bell } from "lucide-react"

const STATUS = {
  pending:   { label: "Pendiente",  tone: "warning" },
  contacted: { label: "Contactado", tone: "info" },
  quoted:    { label: "Cotizado",   tone: "info" },
  closed:    { label: "Cerrado",    tone: "success" },
  rejected:  { label: "Rechazado",  tone: "danger" },
}

function DetailModal({ item, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    status: item.status, admin_notes: item.admin_notes || "",
  })

  const save = useMutation({
    mutationFn: () => updateSpecialOrder(item.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-special-orders"] })
      showToast("Solicitud actualizada")
      onClose()
    },
    onError: () => showToast("No se pudo guardar.", "error"),
  })

  const row = (label, value) => value ? (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: "16px",
      padding: "8px 0", borderBottom: "1px solid var(--admin-border)",
    }}>
      <span style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>{label}</span>
      <span style={{ fontSize: "13px", color: "var(--admin-text)", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  ) : null

  return (
    <FormModal open title="Solicitud bajo pedido" onClose={onClose}
      onSave={() => save.mutate()} saving={save.isPending}>
      <div style={{ marginBottom: "20px" }}>
        {row("Cliente", item.name)}
        {row("Email", item.email)}
        {row("Teléfono", item.phone)}
        {row("Equipo", item.equipment)}
        {row("Marca/modelo", item.brand_model)}
        {row("Cantidad", item.quantity)}
        {row("Presupuesto", item.budget ? `$${Number(item.budget).toLocaleString("es-CL")}` : null)}
        {item.details && (
          <div style={{ padding: "10px 0" }}>
            <span style={{ fontSize: "12px", color: "var(--admin-text-muted)", display: "block", marginBottom: "4px" }}>Detalles</span>
            <p style={{ fontSize: "13px", color: "var(--admin-text)", lineHeight: 1.5 }}>{item.details}</p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <FormField label="Estado">
          <select style={formInputStyle} value={form.status}
            onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            {Object.entries(STATUS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Notas internas">
          <textarea style={{ ...formInputStyle, minHeight: "80px" }} value={form.admin_notes}
            onChange={e => setForm(p => ({ ...p, admin_notes: e.target.value }))}
            placeholder="Seguimiento, cotización enviada, etc." />
        </FormField>
      </div>
    </FormModal>
  )
}

export default function AdminSpecialOrders() {
  const qc = useQueryClient()
  const [detail, setDetail] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-special-orders"],
    queryFn: () => listSpecialOrders(),
  })

  const delMutation = useMutation({
    mutationFn: () => deleteSpecialOrder(toDelete.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-special-orders"] })
      showToast("Eliminada")
      setToDelete(null)
    },
    onError: () => showToast("No se pudo eliminar.", "error"),
  })

  const pendingCount = orders.filter(o => o.status === "pending").length
  const quotedOrClosed = orders.filter(o => o.status === "quoted" || o.status === "closed" || o.status === "contacted").length

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / VENTAS"
        title="Solicitudes bajo pedido"
        description="Equipos que los clientes piden y no están en el catálogo."
        actions={<SecondaryButton to="/admin/orders" size="sm">← Volver a Órdenes</SecondaryButton>}
      />

      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
      {toDelete && (
        <ConfirmationModal open title="Eliminar solicitud"
          description="¿Seguro que querés eliminar esta solicitud?"
          danger onConfirm={() => delMutation.mutate()}
          onCancel={() => setToDelete(null)} loading={delMutation.isPending} />
      )}

      <div className="lp-kpi-strip">
        <StatCard variant="ink" label="Solicitudes totales" value={orders.length} sub="Historial completo" Icon={PackageSearch} />
        <StatCard variant="primary" label="Pendientes de revisar" value={pendingCount} sub={pendingCount > 0 ? "Requieren contacto" : "Sin pendientes"} Icon={Clock3} />
        <StatCard variant="light" label="En gestión / Cerradas" value={quotedOrClosed} sub="Contactadas o cotizadas" Icon={CheckCircle2} />
      </div>

      {pendingCount > 0 && (
        <div className="lp-callout lp-callout--warning">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="lp-alert-icon"><Bell size={18} /></span>
            <div>
              <strong style={{ fontSize: "13.5px", color: "var(--admin-text)" }}>
                Tenés {pendingCount} solicitud{pendingCount !== 1 ? "es" : ""} pendiente{pendingCount !== 1 ? "s" : ""} de revisar
              </strong>
              <p style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>
                Hacé clic en una fila para registrar cotización o seguimiento interno.
              </p>
            </div>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="au-card">
          <EmptyState Icon={PackageSearch} title="Sin solicitudes"
            description="Cuando un cliente solicite un equipo bajo pedido, aparecerá acá." />
        </div>
      ) : (
        <div className="au-card au-table-wrap">
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Equipo</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th style={{ width: 96 }} />
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setDetail(o)}>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--admin-text)" }}>{o.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>{o.email}</div>
                    </td>
                    <td style={{ color: "var(--admin-text)", fontWeight: 500 }}>{o.equipment}</td>
                    <td>{o.quantity}</td>
                    <td>
                      <StatusBadge tone={STATUS[o.status]?.tone || "neutral"}>
                        {STATUS[o.status]?.label || o.status}
                      </StatusBadge>
                    </td>
                    <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <IconButton ghost onClick={() => setDetail(o)} aria-label="Editar"><Pencil size={14} /></IconButton>
                        <IconButton ghost onClick={() => setToDelete(o)} aria-label="Eliminar"><Trash2 size={14} /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
