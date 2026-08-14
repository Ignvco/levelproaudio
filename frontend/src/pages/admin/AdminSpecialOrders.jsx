// pages/admin/AdminSpecialOrders.jsx — Gestión de solicitudes bajo pedido
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listSpecialOrders, updateSpecialOrder, deleteSpecialOrder } from "../../api/admin.api"
import {
  AdminPageHeader, StatusBadge, FormModal, FormField, formInputStyle,
  ConfirmationModal, EmptyState,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { PackageSearch, Pencil, Trash2 } from "lucide-react"

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
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px",
      padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>{label}</span>
      <span style={{ fontSize: "13px", color: "var(--admin-text)", textAlign: "right" }}>{value}</span>
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
  const iconBtn = {
    display: "inline-flex", padding: "6px", borderRadius: "var(--r-md)",
    cursor: "pointer", border: "1px solid var(--border)",
    background: "transparent", color: "var(--admin-text-muted)",
  }

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <AdminPageHeader eyebrow="Ventas" title="Solicitudes bajo pedido"
        subtitle="Equipos que los clientes piden y no están en el catálogo." />

      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
      {toDelete && (
        <ConfirmationModal open title="Eliminar solicitud"
          description="¿Seguro que querés eliminar esta solicitud?"
          danger onConfirm={() => delMutation.mutate()}
          onCancel={() => setToDelete(null)} loading={delMutation.isPending} />
      )}

      {pendingCount > 0 && (
        <div style={{ padding: "12px 16px", borderRadius: "var(--r-lg)", marginBottom: "20px",
          background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)",
          fontSize: "13px", color: "var(--admin-text)" }}>
          Tenés <strong>{pendingCount}</strong> solicitud{pendingCount !== 1 ? "es" : ""} pendiente{pendingCount !== 1 ? "s" : ""} de revisar.
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState Icon={PackageSearch} title="Sin solicitudes"
          description="Cuando un cliente solicite un equipo bajo pedido, aparecerá acá." />
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left",
                color: "var(--admin-text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Cliente</th>
                <th style={{ padding: "12px 16px" }}>Equipo</th>
                <th style={{ padding: "12px 16px" }}>Cantidad</th>
                <th style={{ padding: "12px 16px" }}>Estado</th>
                <th style={{ padding: "12px 16px" }}></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => setDetail(o)}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>{o.email}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{o.equipment}</td>
                  <td style={{ padding: "12px 16px" }}>{o.quantity}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge tone={STATUS[o.status]?.tone || "neutral"}>
                      {STATUS[o.status]?.label || o.status}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button style={iconBtn} onClick={() => setDetail(o)}><Pencil size={13} /></button>
                      <button style={iconBtn} onClick={() => setToDelete(o)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
