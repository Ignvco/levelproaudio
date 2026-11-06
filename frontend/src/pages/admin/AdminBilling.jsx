// pages/admin/AdminBilling.jsx — Documentación Tributaria (registro/seguimiento)
//
// LevelPro ya NO factura. Este panel es un TABLERO de seguimiento: lista
// las órdenes pagadas y permite registrar qué documento tributario se
// emitió por fuera (en el portal del SII), con su número real, fecha y
// estado. El botón "Gestionar en SII" abre el portal oficial.

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTaxDashboard, upsertTaxDocument } from "../../api/admin.api"
import {
  AdminPageHeader, StatusBadge, FormModal, FormField, formInputStyle,
  SecondaryButton, StatCard, EmptyState, SkeletonTable, ErrorState,
} from "../../components/admin/ui"
import { showToast } from "../../components/ui/ToastNotification"
import { formatCurrency } from "../../utils/accountingCurrency"
import { initialTaxDocumentAmount } from "../../utils/billingViewData"
import { ExternalLink, FileText, Inbox, CheckCircle2, Clock3 } from "lucide-react"

const SII_URL = "https://www4.sii.cl/consdcvinternetui/"

const money = (value, currency) => formatCurrency(value, currency)

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
    monto:          initialTaxDocumentAmount(doc, row),
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
    <FormModal open title={`Documento — Orden #${row.order_short}`} onClose={onClose}
      onSave={() => save.mutate()} saving={save.isPending}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{
          padding: "12px 14px", background: "var(--surface-2)",
          borderRadius: "var(--r-md)", fontSize: "13px", color: "var(--text-2)",
        }}>
          <strong style={{ color: "var(--text)" }}>{row.cliente}</strong><br/>
          {row.email} · {money(row.total, row.currency)}
        </div>


        {row.currency !== "CLP" && (
          <p role="note" style={{ fontSize: 12, lineHeight: 1.55, color: "var(--admin-text-secondary)" }}>
            Esta orden está expresada en {row.currency || "moneda no identificada"}.
            El monto del documento debe ingresarse desde el comprobante real del SII:
            no se convierte ni se copia automáticamente el importe de la orden.
            {doc?.monto != null ? " Verifica también que el monto registrado anteriormente coincida con el documento emitido." : ""}
          </p>
        )}

        <a href={SII_URL} target="_blank" rel="noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            alignSelf: "flex-start", fontSize: "13px", color: "var(--admin-primary-text)",
            textDecoration: "none", fontWeight: 700,
          }}>
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

        <FormField label="Monto real del documento tributario">
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tax-dashboard"], queryFn: getTaxDashboard,
  })
  const rows = data?.results || []
  const emittedCount = rows.filter(r => r.documento?.estado === "emitido").length
  const pendingCount = rows.filter(r => !r.documento || r.documento.estado === "pendiente").length

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / TRIBUTARIO"
        title="Documentación Tributaria"
        description="Seguimiento de documentos emitidos en SII. LevelPro solo registra la gestión."
        actions={
          <SecondaryButton href={SII_URL} target="_blank" rel="noreferrer">
            Portal SII <ExternalLink size={14} />
          </SecondaryButton>
        }
      />

      {editing && <RecordModal row={editing} onClose={() => setEditing(null)} />}

      {!isLoading && !isError && <div className="lp-kpi-strip">
        <StatCard variant="ink" label="Órdenes en vista" value={rows.length} sub="Hasta 200 órdenes pagadas recientes" Icon={FileText} />
        <StatCard variant="primary" label="Emitidos en SII" value={emittedCount} sub="Con folio registrado" Icon={CheckCircle2} />
        <StatCard variant="light" label="Pendientes de emitir" value={pendingCount} sub={pendingCount > 0 ? "Por registrar en SII" : "Al día"} Icon={Clock3} />
      </div>}

      {isError ? (
        <ErrorState title="No pudimos cargar el registro tributario"
          description="No asumiremos que faltan documentos si la consulta falló."
          action={<SecondaryButton onClick={() => refetch()}>Reintentar</SecondaryButton>} />
      ) : isLoading ? (
        <SkeletonTable rows={5} />
      ) : rows.length === 0 ? (
        <div className="au-card">
          <EmptyState Icon={Inbox} title="Sin órdenes pagadas" description="No hay órdenes pagadas todavía para registrar documentación tributaria." />
        </div>
      ) : (
        <div className="au-card au-table-wrap">
          <div className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Pago</th>
                  <th>Documento</th>
                  <th>Estado</th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.order_id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text)" }}>#{r.order_short}</td>
                    <td style={{ color: "var(--admin-text)", fontWeight: 500 }}>{r.cliente}</td>
                    <td style={{ fontWeight: 700, color: "var(--admin-primary-text)" }}>{money(r.total, r.currency)}</td>
                    <td>
                      <StatusBadge tone="success">Pagado</StatusBadge>
                    </td>
                    <td>
                      {r.documento
                        ? <span style={{ color: "var(--admin-text)", fontWeight: 500 }}>{r.documento.tipo_label}{r.documento.numero_externo ? ` · ${r.documento.numero_externo}` : ""}</span>
                        : <span style={{ color: "var(--admin-text-muted)" }}>—</span>}
                    </td>
                    <td>
                      {r.documento
                        ? <StatusBadge tone={ESTADO_TONE[r.documento.estado] || "neutral"}>{r.documento.estado_label}</StatusBadge>
                        : <StatusBadge tone="warning">Pendiente</StatusBadge>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <SecondaryButton size="sm" onClick={() => setEditing(r)}>
                        <FileText size={13} /> Registrar
                      </SecondaryButton>
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
