// pages/admin/AdminB2BQuotes.jsx — LEVELPRO OS V4.0 GATE 8 (BF-19, BF-20, BF-40)
// Centro B2B: Cotizaciones, Generador Pro + PDF (2 diseños), Listas de Precios & Tramos, Crédito Comercial
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Building2, Percent, CheckCircle2, ArrowRightLeft, Eye, Inbox,
  FileText, Share2, CreditCard, Plus, Layers, ShieldCheck, Download,
} from "lucide-react"
import {
  getAdminB2BQuotes, getAdminB2BQuoteDetail,
  updateAdminB2BQuote, convertAdminB2BQuote,
  getCrmOrganizations, getB2BPriceLists, saveB2BPriceList,
  resolveB2BPrice, createProB2BQuote, transitionB2BQuoteStatus,
  getB2BQuotePdfMeta, downloadB2BQuotePdfBlob, shareB2BQuote,
  convertProB2BQuote, getB2BCreditAccounts, requestB2BCreditAccount,
  decideB2BCreditAccount,
} from "../../api/b2b.api"
import { getAdminProducts } from "../../api/admin.api"
import {
  AdminPageHeader, StatCard, SectionCard, DataTable, StatusBadge,
  FormModal, FormField, formInputStyle, PrimaryButton, SecondaryButton,
  EmptyState, ErrorState, SkeletonTable,
} from "../../components/admin/ui"
import { formatCurrency } from "../../utils/accountingCurrency"
import { showToast } from "../../utils/toast"

const STATUS_META = {
  draft:     { label: "Borrador",    tone: "neutral" },
  pending:   { label: "Pendiente",   tone: "warning" },
  reviewed:  { label: "En revisión", tone: "info" },
  in_review: { label: "En revisión", tone: "info" },
  approved:  { label: "Aprobada",    tone: "success" },
  issued:    { label: "Emitida",     tone: "info" },
  sent:      { label: "Enviada",     tone: "info" },
  accepted:  { label: "Aceptada",    tone: "success" },
  rejected:  { label: "Rechazada",   tone: "danger" },
  converted: { label: "Convertida",  tone: "success" },
  expired:   { label: "Vencida",     tone: "danger" },
}

const CREDIT_STATUS_META = {
  disabled_pending_policy: { label: "Deshabilitada (Política)", tone: "neutral" },
  pending_approval:        { label: "Pendiente Aprobación",     tone: "warning" },
  active:                  { label: "Activa",                   tone: "success" },
  suspended:               { label: "Suspendida",               tone: "danger" },
  expired:                 { label: "Vencida",                  tone: "danger" },
  blocked:                 { label: "Bloqueada",                tone: "danger" },
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
  const [countryVal, setCountryVal] = useState("CL")
  const [designVariant, setDesignVariant] = useState("classic_corporate")
  const [pdfMeta, setPdfMeta] = useState(null)
  const [shareInfo, setShareInfo] = useState(null)
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
      country: countryVal,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-b2b-quotes"] })
      qc.invalidateQueries({ queryKey: ["admin-b2b-quote-detail", quoteId] })
      showToast("Cotización B2B actualizada")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al actualizar.", "error"),
  })

  const convertMut = useMutation({
    mutationFn: () => convertProB2BQuote(quoteId, { idempotency_key: `ui_b2b_conv:${quoteId}` }).catch(() => convertAdminB2BQuote(quoteId)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-b2b-quotes"] })
      qc.invalidateQueries({ queryKey: ["admin-b2b-quote-detail", quoteId] })
      qc.invalidateQueries({ queryKey: ["admin-orders"] })
      qc.invalidateQueries({ queryKey: ["b2b-credit-accounts"] })
      showToast(`Convertida en orden #${String(res.order_id).slice(0, 8).toUpperCase()}`)
    },
    onError: (e) => showToast(e?.response?.data?.error || "No se pudo convertir.", "error"),
  })

  const pdfMetaMut = useMutation({
    mutationFn: () => getB2BQuotePdfMeta(quoteId, designVariant),
    onSuccess: (res) => {
      setPdfMeta(res)
      showToast(`PDF v${res.version} generado (SHA-256 verificado).`)
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error generando PDF.", "error"),
  })

  const shareMut = useMutation({
    mutationFn: () => shareB2BQuote(quoteId),
    onSuccess: (res) => {
      setShareInfo(res)
      qc.invalidateQueries({ queryKey: ["admin-b2b-quotes"] })
      showToast("Enlace seguro generado.")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error al compartir.", "error"),
  })

  const handleDownloadPdf = async () => {
    try {
      const blob = await downloadB2BQuotePdfBlob(quoteId, designVariant)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cotizacion-${quoteId.slice(0, 8)}-${designVariant}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      showToast(e?.response?.data?.error || "No se pudo descargar el PDF.", "error")
    }
  }

  return (
    <FormModal
      open
      title={quote ? `Cotización · ${quote.company_name}` : "Cargando cotización…"}
      onClose={onClose}
      onSave={() => updateMut.mutate()}
      saving={updateMut.isPending}
      saveLabel="Guardar cambios"
      maxWidth="680px"
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <FormField label="Descuento comercial (%)">
              <input type="number" min="0" max="100" step="0.5" value={discount} onChange={e => setDiscount(e.target.value)} style={formInputStyle} />
            </FormField>
            <FormField label="Jurisdicción Fiscal">
              <select value={countryVal} onChange={e => setCountryVal(e.target.value)} style={formInputStyle}>
                <option value="CL">Chile (IVA 19%)</option>
                <option value="AR">Argentina (Neta)</option>
                <option value="INTL">Exportación Exenta</option>
              </select>
            </FormField>
            <FormField label="Estado">
              <select value={statusVal} onChange={e => setStatusVal(e.target.value)} style={formInputStyle}>
                <option value="draft">Borrador</option>
                <option value="pending">Pendiente</option>
                <option value="reviewed">En revisión</option>
                <option value="approved">Aprobada</option>
                <option value="issued">Emitida</option>
                <option value="sent">Enviada</option>
                <option value="accepted">Aceptada</option>
                <option value="rejected">Rechazada</option>
              </select>
            </FormField>
          </div>

          <FormField label="Notas internas de ventas">
            <textarea rows={2} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} style={{ ...formInputStyle, resize: "vertical" }} />
          </FormField>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderRadius: "10px", background: "var(--admin-surface-soft)", fontSize: "13px" }}>
            <span>Subtotal: {formatCurrency(quote.subtotal, quote.currency)} · Impuesto: {formatCurrency(quote.tax_amount, quote.currency)}</span>
            <strong style={{ fontFamily: "var(--font-mono)", fontSize: "15px" }}>
              Total: {formatCurrency(quote.total, quote.currency)}
            </strong>
          </div>

          {/* Sección PDF & Compartición BF-20 */}
          <div style={{ padding: "12px", borderRadius: "12px", border: "1px solid var(--admin-border)", display: "flex", flexDirection: "column", gap: "8px" }} data-testid="b2b-pdf-preview-card">
            <div style={{ fontSize: "12px", fontWeight: 800 }}>Documento PDF ReportLab & Compartición</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <select value={designVariant} onChange={e => setDesignVariant(e.target.value)} style={{ ...formInputStyle, width: "220px" }}>
                <option value="classic_corporate">Diseño A: Corporativo Clásico</option>
                <option value="modern_technical">Diseño B: Técnico Pro Audio</option>
              </select>
              <SecondaryButton size="sm" data-testid="b2b-pdf-preview-btn" onClick={() => pdfMetaMut.mutate()}>
                <FileText size={13} style={{ marginRight: 4 }} /> Generar Snapshot PDF
              </SecondaryButton>
              <SecondaryButton size="sm" data-testid="b2b-pdf-download-btn" onClick={handleDownloadPdf}>
                <Download size={13} style={{ marginRight: 4 }} /> Descargar PDF
              </SecondaryButton>
              <SecondaryButton size="sm" data-testid="b2b-share-btn" onClick={() => shareMut.mutate()}>
                <Share2 size={13} style={{ marginRight: 4 }} /> Compartir
              </SecondaryButton>
            </div>
            {pdfMeta && (
              <div style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", color: "var(--admin-text-muted)" }}>
                v{pdfMeta.version} ({pdfMeta.design_variant}) · {pdfMeta.file_size_bytes} bytes · SHA-256: {pdfMeta.sha256_checksum.slice(0, 24)}…
              </div>
            )}
            {shareInfo && (
              <div style={{ fontSize: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                <a href={shareInfo.wa_me_url} target="_blank" rel="noreferrer" style={{ color: "#0F9940", fontWeight: 700 }}>Abrir WhatsApp (wa.me)</a>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>{shareInfo.share_url}</span>
              </div>
            )}
          </div>

          {(quote.status === "approved" || quote.status === "issued" || quote.status === "accepted") && !quote.converted_order_id && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <PrimaryButton size="sm" data-testid="b2b-convert-order-btn" disabled={convertMut.isPending} onClick={() => convertMut.mutate()}>
                <ArrowRightLeft size={14} style={{ marginRight: "6px" }} />
                {convertMut.isPending ? "Convirtiendo…" : "Convertir a Pedido OMS/WMS"}
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </FormModal>
  )
}

export default function AdminB2BQuotes() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState("quotes") // quotes | builder | pricelists | credit
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedId, setSelectedId] = useState(null)

  // Builder Pro State
  const [qOrgId, setQOrgId] = useState("")
  const [qCountry, setQCountry] = useState("CL")
  const [qCurrency, setQCurrency] = useState("CLP")
  const [qPayTerms, setQPayTerms] = useState("prepaid")
  const [qProductId, setQProductId] = useState("")
  const [qQty, setQQty] = useState(5)
  const [qResolvedPrice, setQResolvedPrice] = useState(null)
  const [qLines, setQLines] = useState([])

  // Price List State
  const [plModalOpen, setPlModalOpen] = useState(false)
  const [plForm, setPlForm] = useState({
    code: "", name: "", currency: "CLP", country: "CL", scope: "segment",
    applicable_segment: "pro_studio", organization_id: "", product_id: "",
    tier1_price: "95000", tier5_price: "90000", tier10_price: "85000",
  })

  // Credit State
  const [reqCreditOpen, setReqCreditOpen] = useState(false)
  const [reqCreditForm, setReqCreditForm] = useState({ organization_id: "", currency: "CLP", proposed_limit: "1000000", payment_terms: "net_15", notes: "" })
  const [decideAcc, setDecideAcc] = useState(null)
  const [decideForm, setDecideForm] = useState({ action: "approve", credit_limit: "1000000", approval_evidence: "", policy_acknowledged: false, notes: "" })

  const quotesQuery = useQuery({
    queryKey: ["admin-b2b-quotes", statusFilter],
    queryFn: () => getAdminB2BQuotes(statusFilter ? { status: statusFilter } : {}),
  })
  const orgsQuery = useQuery({ queryKey: ["crm-organizations"], queryFn: getCrmOrganizations })
  const productsQuery = useQuery({ queryKey: ["admin-products-mini"], queryFn: () => getAdminProducts({ page_size: 100 }) })
  const priceListsQuery = useQuery({ queryKey: ["b2b-price-lists"], queryFn: getB2BPriceLists })
  const creditQuery = useQuery({ queryKey: ["b2b-credit-accounts"], queryFn: getB2BCreditAccounts })

  const quotes = quotesQuery.data?.results || []
  const orgs = orgsQuery.data?.results || []
  const products = productsQuery.data?.results || []
  const priceLists = priceListsQuery.data?.results || []
  const creditAccounts = creditQuery.data?.results || []

  const resolvePriceMut = useMutation({
    mutationFn: () => resolveB2BPrice({
      product_id: qProductId,
      quantity: Number(qQty) || 1,
      currency: qCurrency,
      organization_id: qOrgId || undefined,
    }),
    onSuccess: (res) => setQResolvedPrice(res),
    onError: (e) => showToast(e?.response?.data?.error || "Error calculando precio B2B.", "error"),
  })

  const createProMut = useMutation({
    mutationFn: () => createProB2BQuote({
      organization_id: qOrgId || undefined,
      country: qCountry,
      currency: qCurrency,
      payment_terms: qPayTerms,
      items: qLines.map(l => ({ product_id: l.product_id, quantity: l.quantity })),
    }),
    onSuccess: async (res) => {
      await transitionB2BQuoteStatus(res.id, "approved").catch(() => null)
      qc.invalidateQueries({ queryKey: ["admin-b2b-quotes"] })
      setQLines([])
      setActiveTab("quotes")
      showToast(`Cotización ${res.quote_number} creada (${formatCurrency(res.total, res.currency)}).`)
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error creando cotización.", "error"),
  })

  const savePlMut = useMutation({
    mutationFn: () => saveB2BPriceList({
      code: plForm.code,
      name: plForm.name,
      currency: plForm.currency,
      country: plForm.country,
      scope: plForm.scope,
      applicable_segment: plForm.applicable_segment,
      organization_id: plForm.organization_id || undefined,
      items: plForm.product_id ? [{
        product_id: plForm.product_id,
        pricing_mode: "fixed_price",
        fixed_price: plForm.tier1_price,
        tiers: [
          { min_quantity: 1, max_quantity: 4, tier_price: plForm.tier1_price },
          { min_quantity: 5, max_quantity: 9, tier_price: plForm.tier5_price },
          { min_quantity: 10, max_quantity: null, tier_price: plForm.tier10_price },
        ],
      }] : [],
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["b2b-price-lists"] })
      setPlModalOpen(false)
      showToast(`Lista B2B ${res.code} v${res.version} guardada.`)
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error guardando lista.", "error"),
  })

  const reqCreditMut = useMutation({
    mutationFn: () => requestB2BCreditAccount(reqCreditForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["b2b-credit-accounts"] })
      setReqCreditOpen(false)
      showToast("Solicitud de crédito registrada (pendiente de aprobación).")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error solicitando crédito.", "error"),
  })

  const decideCreditMut = useMutation({
    mutationFn: () => decideB2BCreditAccount(decideAcc.id, decideForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["b2b-credit-accounts"] })
      setDecideAcc(null)
      showToast("Decisión de crédito registrada.")
    },
    onError: (e) => showToast(e?.response?.data?.error || "Error en decisión de crédito.", "error"),
  })

  const pendingCount = quotes.filter(q => q.status === "pending").length
  const approvedCount = quotes.filter(q => q.status === "approved" || q.status === "converted").length

  const columns = [
    {
      key: "company_name", header: "Empresa / Cliente", render: q => (
        <div>
          <p style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--admin-text)" }}>{q.company_name}</p>
          <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)", fontFamily: "var(--font-mono)" }}>
            {q.tax_id} · {q.contact_name}
          </p>
        </div>
      ),
    },
    { key: "items_count", header: "Ítems", align: "center", render: q => <span style={{ fontFamily: "var(--font-mono)" }}>{q.items_count}</span> },
    { key: "discount_percent", header: "Dcto.", align: "center", render: q => <span style={{ fontFamily: "var(--font-mono)" }}>{q.discount_percent}%</span> },
    {
      key: "total", header: "Total", align: "right", render: q => (
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{formatCurrency(q.total, q.currency)}</span>
      ),
    },
    {
      key: "status", header: "Estado", align: "center", render: q => {
        const meta = STATUS_META[q.status] || { label: q.status, tone: "neutral" }
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      },
    },
    {
      key: "actions", header: "Acción", align: "right", render: q => (
        <SecondaryButton size="sm" data-testid={`open-quote-${q.id}`} onClick={() => setSelectedId(q.id)}>
          <Eye size={13} style={{ marginRight: "5px" }} /> Revisar / PDF
        </SecondaryButton>
      ),
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} data-testid="admin-b2b-page">
      <AdminPageHeader
        eyebrow="LEVELPRO OS V4.0 / GATE 8 B2B & CRÉDITO"
        title="Centro B2B: Cotizaciones, Listas de Precios y Crédito"
        description="Tarifas mayoristas por segmento/volumen, cotizador profesional con PDF ReportLab y control preventivo de crédito Net-15/30."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
        <StatCard variant="ink" Icon={Building2} label="Cotizaciones B2B" value={quotes.length} sub="Historial registrado" />
        <StatCard variant="primary" Icon={Layers} label="Listas de Precios" value={priceLists.length} sub="Tarifas y tramos activos" />
        <StatCard variant="light" Icon={CheckCircle2} label="Aprobadas / Convertidas" value={approvedCount} sub={`Pendientes: ${pendingCount}`} />
        <StatCard variant="light" Icon={CreditCard} label="Cuentas de Crédito" value={creditAccounts.length} sub="Control preventivo Net-15/30" />
      </div>

      {/* Tabs Gate 8 — Nimbus underline tabs */}
      <div className="au-tabs hide-scroll" role="tablist" aria-label="Centro B2B">
        {[
          { id: "quotes", label: "Historial de Cotizaciones" },
          { id: "builder", label: "Generador Pro de Cotizaciones" },
          { id: "pricelists", label: "Listas de Precios y Tramos" },
          { id: "credit", label: "Crédito Comercial B2B" },
        ].map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            data-testid={`b2b-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`au-tab ${activeTab === t.id ? "is-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: HISTORIAL COTIZACIONES */}
      {activeTab === "quotes" && (
        <SectionCard
          title="Solicitudes y Cotizaciones B2B"
          description="Haz clic en Revisar / PDF para generar PDF ReportLab, compartir o convertir a orden OMS/WMS."
          action={
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...formInputStyle, width: "170px", padding: "7px 10px", fontSize: "12.5px" }}>
              <option value="">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="converted">Convertidas</option>
              <option value="rejected">Rechazadas</option>
            </select>
          }
        >
          {quotesQuery.isLoading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : quotesQuery.isError ? (
            <ErrorState title="No se pudieron cargar las cotizaciones" onRetry={() => quotesQuery.refetch()} />
          ) : quotes.length === 0 ? (
            <EmptyState Icon={Inbox} title="Sin cotizaciones B2B" description="Las solicitudes enviadas desde /b2b o el generador Pro aparecerán aquí." />
          ) : (
            <DataTable columns={columns} data={quotes} getRowId={q => q.id} testId="b2b-quotes-table" />
          )}
        </SectionCard>
      )}

      {/* TAB 2: GENERADOR PRO DE COTIZACIONES */}
      {activeTab === "builder" && (
        <SectionCard title="Generador Pro de Cotizaciones B2B" description="Resolución determinista de listas de precios, tramos por volumen e impuestos explícitos.">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <FormField label="Organización B2B">
                <select data-testid="builder-org-select" style={formInputStyle} value={qOrgId} onChange={e => setQOrgId(e.target.value)}>
                  <option value="">Selecciona organización...</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.code} — {o.legal_name}</option>)}
                </select>
              </FormField>
              <FormField label="País / Jurisdicción">
                <select style={formInputStyle} value={qCountry} onChange={e => setQCountry(e.target.value)}>
                  <option value="CL">Chile (IVA 19%)</option>
                  <option value="AR">Argentina</option>
                  <option value="INTL">Exportación</option>
                </select>
              </FormField>
              <FormField label="Moneda">
                <select style={formInputStyle} value={qCurrency} onChange={e => setQCurrency(e.target.value)}>
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </FormField>
              <FormField label="Condición de Pago">
                <select style={formInputStyle} value={qPayTerms} onChange={e => setQPayTerms(e.target.value)}>
                  <option value="prepaid">Contado / Transferencia</option>
                  <option value="net_15">Crédito Net-15</option>
                  <option value="net_30">Crédito Net-30</option>
                </select>
              </FormField>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <FormField label="Producto del Catálogo" style={{ flex: 1, minWidth: 220 }}>
                <select data-testid="builder-product-select" style={formInputStyle} value={qProductId} onChange={e => setQProductId(e.target.value)}>
                  <option value="">Selecciona producto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku || "SKU"} — {p.name}</option>)}
                </select>
              </FormField>
              <FormField label="Cantidad" style={{ width: 100 }}>
                <input type="number" min="1" style={formInputStyle} value={qQty} onChange={e => setQQty(e.target.value)} />
              </FormField>
              <SecondaryButton size="sm" onClick={() => qProductId && resolvePriceMut.mutate()}>Calcular Tarifa B2B</SecondaryButton>
              <PrimaryButton
                size="sm"
                data-testid="builder-add-line-btn"
                disabled={!qProductId}
                onClick={() => {
                  const p = products.find(x => String(x.id) === String(qProductId))
                  if (!p) return
                  setQLines([...qLines, { product_id: p.id, name: p.name, quantity: Number(qQty) || 1, preview: qResolvedPrice }])
                }}
              >
                <Plus size={14} style={{ marginRight: 4 }} /> Agregar Línea
              </PrimaryButton>
            </div>

            {qResolvedPrice && (
              <div style={{ padding: 10, borderRadius: 10, background: "var(--admin-surface-soft)", fontSize: 12.5, fontFamily: "var(--font-mono)" }}>
                Catálogo: {qResolvedPrice.catalog_unit_price} → Propuesto B2B: <strong>{qResolvedPrice.b2b_proposed_price} {qResolvedPrice.currency}</strong> (Fuente: {qResolvedPrice.pricing_source})
              </div>
            )}

            {qLines.length > 0 && (
              <div style={{ border: "1px solid var(--admin-border)", borderRadius: 10, padding: 12 }}>
                {qLines.map((ln, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                    <span>{ln.quantity}× {ln.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{ln.preview?.b2b_proposed_price || "Según lista B2B"}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, textAlign: "right" }}>
                  <PrimaryButton data-testid="builder-create-quote-btn" disabled={createProMut.isPending} onClick={() => createProMut.mutate()}>
                    Emitir Cotización Pro
                  </PrimaryButton>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* TAB 3: LISTAS DE PRECIOS Y TRAMOS */}
      {activeTab === "pricelists" && (
        <SectionCard
          title="Listas de Precios B2B y Escalones por Volumen"
          description="Precedencia: Contrato Cliente > Lista Organización > Segmento > Catálogo Público."
          action={
            <PrimaryButton size="sm" data-testid="new-pricelist-btn" onClick={() => setPlModalOpen(true)}>
              <Plus size={14} style={{ marginRight: 4 }} /> Nueva Lista B2B
            </PrimaryButton>
          }
        >
          {priceLists.length === 0 ? (
            <EmptyState Icon={Layers} title="Sin listas B2B" description="Crea listas por segmento o por organización con escalones de volumen." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {priceLists.map(pl => (
                <div key={pl.id} style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800 }}>{pl.code} (v{pl.version})</span> — <strong>{pl.name}</strong>
                    </div>
                    <StatusBadge tone={pl.status === "active" ? "success" : "neutral"}>{pl.scope} · {pl.currency}</StatusBadge>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--admin-text-muted)" }}>
                    Ítems configurados: {pl.items?.length || 0} · Margen mínimo: {pl.min_margin_percent}%
                    {(pl.items || []).map(it => (
                      <div key={it.id} style={{ fontFamily: "var(--font-mono)", marginTop: 4 }}>
                        • {it.sku} ({it.product_name}): {(it.tiers || []).map(t => `[${t.min_quantity}-${t.max_quantity || "+"}: ${t.tier_price}]`).join(" ")}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* TAB 4: CRÉDITO COMERCIAL B2B */}
      {activeTab === "credit" && (
        <SectionCard
          title="Cuentas de Crédito Comercial B2B (Control Preventivo)"
          description="Por política de seguridad inicial, toda cuenta nueva nace deshabilitada hasta autorización financiera."
          action={
            <PrimaryButton size="sm" data-testid="request-credit-btn" onClick={() => setReqCreditOpen(true)}>
              <Plus size={14} style={{ marginRight: 4 }} /> Solicitar Línea de Crédito
            </PrimaryButton>
          }
        >
          {creditAccounts.length === 0 ? (
            <EmptyState Icon={CreditCard} title="Sin cuentas de crédito" description="Solicita una línea comercial Net-15 o Net-30 para una organización." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="credit-accounts-list">
              {creditAccounts.map(ca => {
                const meta = CREDIT_STATUS_META[ca.status] || { label: ca.status, tone: "neutral" }
                return (
                  <div key={ca.id} style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>{ca.organization_code} — {ca.organization_name}</div>
                      <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--admin-text-muted)" }}>
                        Límite: {formatCurrency(ca.credit_limit, ca.currency)} · Comprometido: {formatCurrency(ca.committed_exposure, ca.currency)} · Disponible: <strong>{formatCurrency(ca.available_credit, ca.currency)}</strong>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      <SecondaryButton size="sm" data-testid={`decide-credit-${ca.id}`} onClick={() => setDecideAcc(ca)}>
                        <ShieldCheck size={13} style={{ marginRight: 4 }} /> Autorizar / Gestionar
                      </SecondaryButton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )}

      {selectedId && <QuoteDetailModal quoteId={selectedId} onClose={() => setSelectedId(null)} />}

      {/* MODAL NUEVA LISTA B2B */}
      <FormModal open={plModalOpen} title="Nueva Lista de Precios B2B" onClose={() => setPlModalOpen(false)} onSave={() => savePlMut.mutate()} saving={savePlMut.isPending} saveLabel="Guardar Lista">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Código"><input style={formInputStyle} value={plForm.code} onChange={e => setPlForm({ ...plForm, code: e.target.value })} placeholder="PL-PRO-2026" /></FormField>
            <FormField label="Nombre"><input style={formInputStyle} value={plForm.name} onChange={e => setPlForm({ ...plForm, name: e.target.value })} placeholder="Lista Estudios Pro" /></FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Alcance">
              <select style={formInputStyle} value={plForm.scope} onChange={e => setPlForm({ ...plForm, scope: e.target.value })}>
                <option value="segment">Segmento B2B</option>
                <option value="organization">Organización específica</option>
                <option value="customer_contract">Contrato cliente</option>
              </select>
            </FormField>
            <FormField label="Moneda">
              <select style={formInputStyle} value={plForm.currency} onChange={e => setPlForm({ ...plForm, currency: e.target.value })}>
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </FormField>
          </div>
          <FormField label="Producto (Tramos 1-4 / 5-9 / 10+)">
            <select style={formInputStyle} value={plForm.product_id} onChange={e => setPlForm({ ...plForm, product_id: e.target.value })}>
              <option value="">Selecciona producto...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <FormField label="1-4 unid."><input type="number" style={formInputStyle} value={plForm.tier1_price} onChange={e => setPlForm({ ...plForm, tier1_price: e.target.value })} /></FormField>
            <FormField label="5-9 unid."><input type="number" style={formInputStyle} value={plForm.tier5_price} onChange={e => setPlForm({ ...plForm, tier5_price: e.target.value })} /></FormField>
            <FormField label="10+ unid."><input type="number" style={formInputStyle} value={plForm.tier10_price} onChange={e => setPlForm({ ...plForm, tier10_price: e.target.value })} /></FormField>
          </div>
        </div>
      </FormModal>

      {/* MODAL SOLICITAR CRÉDITO */}
      <FormModal open={reqCreditOpen} title="Solicitar Línea de Crédito B2B" onClose={() => setReqCreditOpen(false)} onSave={() => reqCreditMut.mutate()} saving={reqCreditMut.isPending} saveLabel="Enviar Solicitud">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FormField label="Organización">
            <select style={formInputStyle} value={reqCreditForm.organization_id} onChange={e => setReqCreditForm({ ...reqCreditForm, organization_id: e.target.value })}>
              <option value="">Selecciona organización...</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.code} — {o.legal_name}</option>)}
            </select>
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Límite Propuesto"><input type="number" style={formInputStyle} value={reqCreditForm.proposed_limit} onChange={e => setReqCreditForm({ ...reqCreditForm, proposed_limit: e.target.value })} /></FormField>
            <FormField label="Términos">
              <select style={formInputStyle} value={reqCreditForm.payment_terms} onChange={e => setReqCreditForm({ ...reqCreditForm, payment_terms: e.target.value })}>
                <option value="net_15">Net-15</option>
                <option value="net_30">Net-30</option>
              </select>
            </FormField>
          </div>
        </div>
      </FormModal>

      {/* MODAL DECISIÓN CRÉDITO */}
      <FormModal open={!!decideAcc} title="Autorización Gerencial de Crédito" onClose={() => setDecideAcc(null)} onSave={() => decideCreditMut.mutate()} saving={decideCreditMut.isPending} saveLabel="Ejecutar Decisión">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FormField label="Acción">
            <select style={formInputStyle} value={decideForm.action} onChange={e => setDecideForm({ ...decideForm, action: e.target.value })}>
              <option value="approve">Aprobar y Activar</option>
              <option value="suspend">Suspender</option>
              <option value="reject">Rechazar</option>
            </select>
          </FormField>
          <FormField label="Límite Autorizado"><input type="number" style={formInputStyle} value={decideForm.credit_limit} onChange={e => setDecideForm({ ...decideForm, credit_limit: e.target.value })} /></FormField>
          <FormField label="Evidencia Documental de Aprobación"><input style={formInputStyle} value={decideForm.approval_evidence} onChange={e => setDecideForm({ ...decideForm, approval_evidence: e.target.value })} placeholder="Ej. Acta Comité Crédito #2026-11" /></FormField>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700 }}>
            <input type="checkbox" checked={decideForm.policy_acknowledged} onChange={e => setDecideForm({ ...decideForm, policy_acknowledged: e.target.checked })} />
            Confirmo cumplimiento de política comercial B2B (SoD)
          </label>
        </div>
      </FormModal>
    </div>
  )
}
