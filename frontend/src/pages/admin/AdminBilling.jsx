// pages/admin/AdminBilling.jsx — Documentación Tributaria (registro/seguimiento)
//
// LevelPro ya NO factura. Este panel es un TABLERO de seguimiento: lista
// las órdenes pagadas y permite registrar qué documento tributario se
// emitió por fuera (en el portal del SII), con su número real, fecha y
// estado. El botón "Gestionar en SII" abre el portal oficial.

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTaxDashboard, upsertTaxDocument } from "../../api/admin.api"
import { AdminPageHeader, StatusBadge, FormModal, FormField, formInputStyle, PrimaryButton } from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { ExternalLink, FileText, Inbox } from "lucide-react"

const SII_URL = "https://www4.sii.cl/consdcvinternetui/"

const money = (v) => v == null ? "—" : `$${Number(v).toLocaleString("es-CL")}`

const ESTADO_TONE = {
  pendiente: "warning",
  emitido:   "success",
  no_aplica: "neutral",
}

function RecordModal({ row, onClose }) {
  const qc = useQueryClient()
  const doc = row.documento
  const [form, setForm] = useState({
    tipo:           doc?.tipo           || "boleta",
    numero_externo: doc?.numero_externo || "",
    fecha_emision:  doc?.fecha_emision  || "",
    estado:         doc?.estado         || "pendiente",
    monto:          doc?.monto ?? row.total,
    observaciones:  doc?.observaciones  || "",
  })

  const save = useMutation({
    mutationFn: () => upsertTaxDocument({ order_id: row.order_id, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-dashboard"] })
      showToast("Documento registrado")
      onClose()
    },
    onError: (e) => showToast(e?.response?.data?.error || "No se pudo guardar.", "error"),
  })

  return (
    <FormModal title={`Documento — Orden #${row.order_short}`} onClose={onClose}
      onSave={() => save.mutate()} saving={save.isPending}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ padding: "12px 14px", background: "var(--surface-2)",
          borderRadius: "var(--r-md)", fontSize: "13px", color: "var(--text-2)" }}>
          <strong style={{ color: "var(--text)" }}>{row.cliente}</strong><br/>
          {row.email} · {money(row.total)}
        </div>

        <a href={SII_URL} target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px",
            alignSelf: "flex-start", fontSize: "13px", color: "var(--accent)",
            textDecoration: "none", fontWeight: 600 }}>
          <ExternalLink size={15} /> Gestionar en SII
        </a>

        <FormField label="Tipo de documento">
          <select style={formInputStyle} value={form.tipo}
            onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
            <option value="boleta">Boleta</option>
            <option value="factura">Factura</option>
            <option value="nota_credito">Nota de Crédito</option>
            <option value="ninguno">Sin documento</option>
          </select>
        </FormField>

        <FormField label="N° de documento (el real del SII)">
          <input style={formInputStyle} value={form.numero_externo}
            onChange={e => setForm(p => ({ ...p, numero_externo: e.target.value }))}
            placeholder="Ej: 12345" />
        </FormField>

        <FormField label="Fecha de emisión">
          <input type="date" style={formInputStyle} value={form.fecha_emision || ""}
            onChange={e => setForm(p => ({ ...p, fecha_emision: e.target.value }))} />
        </FormField>

        <FormField label="Estado">
          <select style={formInputStyle} value={form.estado}
            onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
            <option value="pendiente">Pendiente de emitir en SII</option>
            <option value="emitido">Emitido en SII</option>
            <option value="no_aplica">No aplica</option>
          </select>
        </FormField>

        <FormField label="Monto">
          <input type="number" min="0" style={formInputStyle} value={form.monto ?? ""}
            onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} />
        </FormField>

        <FormField label="Observaciones">
          <textarea style={{ ...formInputStyle, minHeight: "70px" }} value={form.observaciones}
            onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
        </FormField>
      </div>
    </FormModal>
  )
}

export default function AdminBilling() {
  const [editing, setEditing] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ["tax-dashboard"], queryFn: getTaxDashboard,
  })
  const rows = data?.results || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <AdminPageHeader
        title="Documentación Tributaria"
        subtitle="Registro y seguimiento de boletas/facturas emitidas en el SII. LevelPro no emite documentos — solo lleva la trazabilidad."
      />

      {editing && <RecordModal row={editing} onClose={() => setEditing(null)} />}

      {isLoading ? (
        <p style={{ color: "var(--text-3)", padding: "40px 0" }}>Cargando…</p>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)" }}>
          <Inbox size={40} style={{ opacity: 0.4, marginBottom: "12px" }} />
          <p>No hay órdenes pagadas todavía.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left",
                color: "var(--text-3)", fontSize: "11px", textTransform: "uppercase",
                letterSpacing: "0.05em" }}>
                <th style={{ padding: "12px 16px" }}>Pedido</th>
                <th style={{ padding: "12px 16px" }}>Cliente</th>
                <th style={{ padding: "12px 16px" }}>Monto</th>
                <th style={{ padding: "12px 16px" }}>Pago</th>
                <th style={{ padding: "12px 16px" }}>Documento</th>
                <th style={{ padding: "12px 16px" }}>Estado</th>
                <th style={{ padding: "12px 16px" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.order_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)" }}>#{r.order_short}</td>
                  <td style={{ padding: "12px 16px" }}>{r.cliente}</td>
                  <td style={{ padding: "12px 16px" }}>{money(r.total)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge tone="success">Pagado</StatusBadge>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {r.documento
                      ? <span>{r.documento.tipo_label}{r.documento.numero_externo ? ` · ${r.documento.numero_externo}` : ""}</span>
                      : <span style={{ color: "var(--text-3)" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {r.documento
                      ? <StatusBadge tone={ESTADO_TONE[r.documento.estado] || "neutral"}>{r.documento.estado_label}</StatusBadge>
                      : <StatusBadge tone="warning">Pendiente</StatusBadge>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button onClick={() => setEditing(r)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px",
                        background: "var(--surface-2)", border: "1px solid var(--border)",
                        borderRadius: "var(--r-md)", padding: "7px 12px", cursor: "pointer",
                        color: "var(--text)", fontSize: "12px", fontWeight: 600 }}>
                      <FileText size={13} /> Registrar
                    </button>
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
