// pages/admin/AdminB2BQuotes.jsx — Gestión administrativa de cotizaciones B2B mayoristas (V3.3)
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Building2, Percent, CheckCircle2, ArrowRightLeft, Eye, Inbox } from "lucide-react"
import {
  getAdminB2BQuotes, getAdminB2BQuoteDetail,
  updateAdminB2BQuote, convertAdminB2BQuote,
} from "../../api/b2b.api"
import {
  AdminPageHeader, StatCard, SectionCard, DataTable, StatusBadge,
  FormModal, FormField, formInputStyle, PrimaryButton, SecondaryButton,
  EmptyState, ErrorState, SkeletonTable,
} from "../../components/admin/ui"
import { formatCurrency } from "../../utils/accountingCurrency"
import { showToast } from "../../utils/toast"

const STATUS_META = {
  pending:   { label: "Pendiente",   tone: "warning" },
  in_review: { label: "En revisión", tone: "info" },
  approved:  { label: "Aprobada",    tone: "success" },
  rejected:  { label: "Rechazada",   tone: "danger" },
  converted: { label: "Convertida",  tone: "success" },
}

function QuoteDetailModal({ quoteId, onClose }) {
  const qc = useQueryClient()
  const { data: quote, isLoading } = useQuery({
    queryKey: ["admin-b2b-quote-detail", quoteId],
    queryFn: () => getAdminB2BQuoteDetail(quoteId),
    enabled: !!quoteId,
  })

  const [discount, setDiscount] = useState("")
  const [statusVal, setStatusVal] = useState("")
  const [adminNotes, setAdminNotes] = useState("")
  const [initialized, setInitialized] = useState(false)

  if (quote && !initialized) {
    setDiscount(String(quote.discount_percent ?? 0))
    setStatusVal(quote.status)
    setAdminNotes(quote.admin_notes || "")
    setInitialized(true)
  }

  const updateMut = useMutation({
    mutationFn: () => updateAdminB2BQuote(quoteId, {
      discount_percent: Number(discount) || 0,
      status: statusVal,
      admin_notes: adminNotes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-b2b-quotes"] })
      qc.invalidateQueries({ queryKey: ["admin-b2b-quote-detail", quoteId] })
      showToast("Cotización B2B actualizada")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al actualizar.", "error"),
  })

  const convertMut = useMutation({
    mutationFn: () => convertAdminB2BQuote(quoteId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-b2b-quotes"] })
      qc.invalidateQueries({ queryKey: ["admin-b2b-quote-detail", quoteId] })
      qc.invalidateQueries({ queryKey: ["admin-orders"] })
      showToast(`Convertida en orden #${String(res.order_id).slice(0, 8).toUpperCase()}`)
    },
    onError: (e) => showToast(e?.response?.data?.error || "No se pudo convertir.", "error"),
  })

  return (
    <FormModal
      open
      title={quote ? `Cotización · ${quote.company_name}` : "Cargando cotización…"}
      onClose={onClose}
      onSave={() => updateMut.mutate()}
      saving={updateMut.isPending}
      saveLabel="Guardar cambios"
      maxWidth="620px"
      scrollableBody
    >
      {isLoading || !quote ? (
        <p style={{ fontSize: "13px", color: "var(--admin-text-muted)", padding: "24px 0" }}>Cargando detalle…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "12px", borderRadius: "12px", background: "var(--admin-surface-soft)", border: "1px solid var(--admin-border)", fontSize: "12.5px" }}>
            <div><strong>RUT/CUIT:</strong> {quote.tax_id}</div>
            <div><strong>Contacto:</strong> {quote.contact_name}</div>
            <div><strong>Email:</strong> {quote.email}</div>
            <div><strong>Teléfono:</strong> {quote.phone || "—"}</div>
          </div>

          {quote.client_notes && (
            <div style={{ fontSize: "12.5px", padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--admin-border)" }}>
              <strong>Notas cliente:</strong> {quote.client_notes}
            </div>
          )}

          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--admin-text-muted)", marginBottom: "6px" }}>
              Equipos cotizados
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {(quote.items || []).map(it => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "8px 10px", borderRadius: "8px", background: "var(--admin-surface-soft)" }}>
                  <span>{it.quantity}× {it.product_name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {formatCurrency(it.subtotal, quote.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="Descuento comercial (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discount}
                disabled={quote.status === "converted"}
                onChange={e => setDiscount(e.target.value)}
                style={formInputStyle}
              />
            </FormField>
            <FormField label="Estado">
              <select
                value={statusVal}
                disabled={quote.status === "converted"}
                onChange={e => setStatusVal(e.target.value)}
                style={formInputStyle}
              >
                <option value="pending">Pendiente</option>
                <option value="in_review">En revisión</option>
                <option value="approved">Aprobada</option>
                <option value="rejected">Rechazada</option>
                {quote.status === "converted" && <option value="converted">Convertida</option>}
              </select>
            </FormField>
          </div>

          <FormField label="Notas comerciales internas">
            <textarea
              rows={2}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              style={{ ...formInputStyle, resize: "vertical" }}
            />
          </FormField>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderRadius: "12px", background: "var(--admin-surface-soft)", border: "1px solid var(--admin-border)" }}>
            <div style={{ fontSize: "13px" }}>
              <div>Total actual: <strong style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(quote.total, quote.currency)} {quote.currency}</strong></div>
              {quote.discount_percent > 0 && (
                <div style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>
                  Incluye {quote.discount_percent}% dto. ({formatCurrency(quote.discount_amount, quote.currency)})
                </div>
              )}
            </div>

            {quote.status === "approved" && !quote.converted_order_id && (
              <PrimaryButton
                size="sm"
                loading={convertMut.isPending}
                onClick={() => convertMut.mutate()}
              >
                <ArrowRightLeft size={14} /> Convertir a orden
              </PrimaryButton>
            )}
            {quote.converted_order_id && (
              <StatusBadge tone="success" label={`Orden #${String(quote.converted_order_id).slice(0, 8).toUpperCase()}`} />
            )}
          </div>
        </div>
      )}
    </FormModal>
  )
}

export default function AdminB2BQuotes() {
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [activeId, setActiveId] = useState(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-b2b-quotes", statusFilter, search],
    queryFn: () => getAdminB2BQuotes({
      status: statusFilter || undefined,
      search: search || undefined,
    }),
  })

  const quotes = data?.results || []
  const pendingCount = quotes.filter(q => q.status === "pending").length
  const approvedCount = quotes.filter(q => q.status === "approved").length
  const convertedCount = quotes.filter(q => q.status === "converted").length

  const columns = [
    {
      key: "company_name",
      label: "Empresa",
      render: (q) => (
        <div>
          <p style={{ fontWeight: 700, fontSize: "13.5px" }}>{q.company_name}</p>
          <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
            {q.tax_id} · {q.contact_name}
          </p>
        </div>
      ),
    },
    {
      key: "items_count",
      label: "Equipos",
      render: (q) => <span style={{ fontFamily: "var(--font-mono)" }}>{q.items_count}</span>,
    },
    {
      key: "discount_percent",
      label: "Dto.",
      render: (q) => (
        <span style={{ fontFamily: "var(--font-mono)", color: q.discount_percent > 0 ? "#0F9940" : "var(--admin-text-muted)" }}>
          {q.discount_percent}%
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      render: (q) => (
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
          {formatCurrency(q.total, q.currency)} {q.currency}
        </span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      render: (q) => {
        const meta = STATUS_META[q.status] || { label: q.status, tone: "neutral" }
        return <StatusBadge tone={meta.tone} label={meta.label} />
      },
    },
    {
      key: "created_at",
      label: "Fecha",
      render: (q) => <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>{q.created_at}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (q) => (
        <SecondaryButton size="sm" onClick={() => setActiveId(q.id)}>
          <Eye size={13} /> Gestionar
        </SecondaryButton>
      ),
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <AdminPageHeader
        eyebrow="Comercial B2B"
        title="Cotizaciones mayoristas"
        subtitle="Revisa solicitudes de estudios e instituciones, aplica descuentos por volumen y convierte cotizaciones aprobadas en órdenes de compra."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px" }}>
        <StatCard Icon={Building2} label="Total cotizaciones" value={data?.count ?? quotes.length} />
        <StatCard Icon={Percent} label="Pendientes" value={pendingCount} />
        <StatCard Icon={CheckCircle2} label="Aprobadas" value={approvedCount} />
        <StatCard Icon={ArrowRightLeft} label="Convertidas a orden" value={convertedCount} />
      </div>

      <SectionCard
        title="Solicitudes B2B"
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar razón social, RUT/CUIT…"
              style={{ ...formInputStyle, width: "220px", padding: "7px 11px", fontSize: "12.5px" }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ ...formInputStyle, width: "160px", padding: "7px 11px", fontSize: "12.5px" }}
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="in_review">En revisión</option>
              <option value="approved">Aprobada</option>
              <option value="converted">Convertida</option>
              <option value="rejected">Rechazada</option>
            </select>
          </div>
        }
      >
        {isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : isError ? (
          <ErrorState message="No pudimos cargar las cotizaciones B2B." onRetry={refetch} />
        ) : quotes.length === 0 ? (
          <EmptyState Icon={Inbox} title="Sin cotizaciones B2B" description="Cuando un estudio o empresa solicite una cotización en /b2b aparecerá aquí." />
        ) : (
          <DataTable columns={columns} rows={quotes} />
        )}
      </SectionCard>

      {activeId && <QuoteDetailModal quoteId={activeId} onClose={() => setActiveId(null)} />}
    </div>
  )
}
