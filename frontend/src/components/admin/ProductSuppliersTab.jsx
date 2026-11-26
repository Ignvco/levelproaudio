// components/admin/ProductSuppliersTab.jsx — Pestaña Proveedores y Matriz Comparativa en Ficha de Producto
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getAdminSuppliers,
  getAdminProductSuppliers,
  linkProductSupplier,
  selectPreferredProductSupplier,
  getAdminProductSupplierPriceHistory,
} from "../../api/suppliers.api"
import { SectionCard, PrimaryButton, SecondaryButton, StatusBadge, FormField, formInputStyle } from "./ui"
import { showToast } from "../../utils/toast"
import { formatCurrency } from "../../utils/accountingCurrency"
import { Star, Plus, History } from "lucide-react"

const AVAIL_LABELS = {
  in_stock: "Disponible",
  low_stock: "Stock limitado",
  on_order: "Bajo pedido",
  out_of_stock: "Sin stock prov.",
  unknown: "No informado",
}

export default function ProductSuppliersTab({ product, variants = [] }) {
  const hasVariants = variants.length > 0
  const [selectedVariantId, setSelectedVariantId] = useState(hasVariants ? variants[0].id : "")
  const [sortBy, setSortBy] = useState("cost")
  const [includeRef, setIncludeRef] = useState(false)
  const [targetCurrency, setTargetCurrency] = useState("CLP")

  useEffect(() => {
    if (hasVariants && !selectedVariantId) {
      setSelectedVariantId(variants[0].id)
    }
  }, [hasVariants, variants, selectedVariantId])

  const { data: allSuppliersData } = useQuery({
    queryKey: ["admin-suppliers-active-select"],
    queryFn: () => getAdminSuppliers({ is_active: "true" }),
  })
  const { data: comparison, isLoading, refetch } = useQuery({
    queryKey: ["admin-product-suppliers", product.id, selectedVariantId, sortBy, includeRef, targetCurrency],
    queryFn: () => getAdminProductSuppliers(product.id, {
      variant_id: hasVariants ? selectedVariantId : undefined,
      sort: sortBy,
      include_referential: includeRef ? "true" : "false",
      target_currency: targetCurrency,
    }),
    enabled: !hasVariants || !!selectedVariantId,
  })
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["admin-product-supplier-history", product.id, selectedVariantId],
    queryFn: () => getAdminProductSupplierPriceHistory(product.id, hasVariants ? selectedVariantId : ""),
    enabled: !hasVariants || !!selectedVariantId,
  })

  const [linkForm, setLinkForm] = useState({
    supplier_id: "",
    supplier_sku: "",
    unit_cost: "",
    currency: "USD",
    tax_basis: "net",
    moq: "1",
    lead_time_days: "7",
    reported_availability: "in_stock",
    cost_valid_until: "",
  })
  const [saving, setSaving] = useState(false)

  const activeSuppliers = allSuppliersData?.results || []
  const alternatives = comparison?.alternatives || []
  const historyRows = historyData?.results || []

  const handleLink = async (e) => {
    e.preventDefault()
    if (!linkForm.supplier_id || !linkForm.unit_cost) {
      showToast("Proveedor y costo unitario son obligatorios", "error")
      return
    }
    setSaving(true)
    try {
      await linkProductSupplier(product.id, {
        ...linkForm,
        variant_id: hasVariants ? selectedVariantId : null,
        moq: Number(linkForm.moq) || 1,
        lead_time_days: Number(linkForm.lead_time_days) || 0,
        cost_valid_until: linkForm.cost_valid_until || null,
      })
      showToast("Proveedor vinculado al SKU")
      setLinkForm((f) => ({ ...f, supplier_sku: "", unit_cost: "" }))
      refetch()
      refetchHistory()
    } catch (err) {
      showToast(err?.response?.data?.error ? JSON.stringify(err.response.data.error) : "Error al vincular proveedor", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleSelectPreferred = async (linkId) => {
    try {
      await selectPreferredProductSupplier(product.id, linkId)
      showToast("Proveedor preferente actualizado")
      refetch()
    } catch (err) {
      showToast(err?.response?.data?.error || "No se pudo seleccionar proveedor preferente", "error")
    }
  }

  return (
    <div className="au-stack">
      <SectionCard
        title="Comparación de Proveedores"
        description={comparison?.internal_sku ? `SKU Comercial: ${comparison.internal_sku}` : "Selecciona la unidad comercial a comparar"}
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {hasVariants && (
              <select
                data-testid="supplier-variant-selector"
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                style={{ ...formInputStyle, width: "auto" }}
              >
                {variants.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.sku})</option>)}
              </select>
            )}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...formInputStyle, width: "auto" }}>
              <option value="cost">Ordenar por costo</option>
              <option value="lead_time">Ordenar por plazo</option>
              <option value="moq">Ordenar por MOQ</option>
              <option value="preferred">Ordenar por preferente</option>
            </select>
            <label style={{ fontSize: 12, color: "#09090B", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={includeRef} onChange={(e) => setIncludeRef(e.target.checked)} />
              Ref. {targetCurrency}
            </label>
            {includeRef && (
              <select value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)} style={{ ...formInputStyle, width: "auto" }}>
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            )}
          </div>
        }
      >
        {comparison?.referential_meta && (
          <p style={{ fontSize: 12, color: "#71717A", marginBottom: 12 }}>
            Conversión referencial informativa ({comparison.referential_meta.source}: 1 USD = {comparison.referential_meta.usd_to_clp} CLP / {comparison.referential_meta.usd_to_ars} ARS). No altera costos originales.
          </p>
        )}

        {isLoading ? (
          <p style={{ color: "#71717A", fontSize: 13 }}>Cargando alternativas de abastecimiento…</p>
        ) : alternatives.length === 0 ? (
          <p style={{ color: "#71717A", fontSize: 13 }}>Este SKU no tiene proveedores vinculados todavía.</p>
        ) : (
          <div className="au-tscroll">
            <table className="au-table" data-testid="product-suppliers-comparison-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Cód. Prov.</th>
                  <th>Costo Original</th>
                  <th>Disponibilidad</th>
                  <th>MOQ / Plazo</th>
                  <th>Vigencia / Pago</th>
                  <th>Preferente</th>
                </tr>
              </thead>
              <tbody>
                {alternatives.map((alt) => (
                  <tr key={alt.id} data-testid={`comparison-row-${alt.supplier_code}`}>
                    <td>
                      <p style={{ fontWeight: 600, color: "#09090B", margin: 0 }}>{alt.supplier_name}</p>
                      <p style={{ fontSize: 11.5, color: "#71717A", margin: "2px 0 0" }}>{alt.supplier_code} · {alt.supplier_country}</p>
                    </td>
                    <td className="lp-mono">{alt.supplier_sku || "—"}</td>
                    <td className="lp-mono">
                      {alt.unit_cost != null ? (
                        <div>
                          <span style={{ color: alt.is_best_comparable_cost ? "#0F7A38" : "#09090B", fontWeight: 600 }}>
                            {formatCurrency(alt.unit_cost, alt.currency)} {alt.currency}
                          </span>
                          <span style={{ display: "block", fontSize: 11.5, color: "#71717A", fontFamily: "var(--font-sans)" }}>
                            {alt.tax_basis === "net" ? "Neto" : "Imp. incl."}
                            {alt.is_best_comparable_cost ? " · Menor costo comparable" : ""}
                          </span>
                          {alt.referential_conversion && (
                            <span style={{ display: "block", fontSize: 11.5, color: "#1D4ED8", fontWeight: 500 }}>
                              ≈ {formatCurrency(alt.referential_conversion.converted_amount, alt.referential_conversion.target_currency)} ref.
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#71717A" }}>Restringido</span>
                      )}
                    </td>
                    <td style={{ color: "#09090B", fontWeight: 500 }}>
                      {AVAIL_LABELS[alt.reported_availability] || alt.reported_availability}
                      {alt.reported_available_qty != null ? ` (${alt.reported_available_qty} u.)` : ""}
                    </td>
                    <td className="lp-mono">
                      {alt.moq} u. · {alt.lead_time_days}d
                    </td>
                    <td>
                      <StatusBadge tone={alt.is_cost_expired ? "warning" : "success"}>
                        {alt.is_cost_expired ? "Vencida" : "Vigente"}
                      </StatusBadge>
                      <p style={{ fontSize: 11.5, color: "#71717A", marginTop: 3 }}>{alt.payment_terms || "—"}</p>
                    </td>
                    <td>
                      {alt.is_preferred ? (
                        <StatusBadge tone="success">Preferente</StatusBadge>
                      ) : (
                        <SecondaryButton
                          size="sm"
                          icon={Star}
                          data-testid={`select-preferred-${alt.supplier_code}`}
                          onClick={() => handleSelectPreferred(alt.id)}
                        >
                          Elegir preferente
                        </SecondaryButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Agregar o actualizar proveedor del SKU" description="Vinculación directa de alternativa de compra">
        <form onSubmit={handleLink} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, alignItems: "end" }}>
          <FormField label="Proveedor" required>
            <select required value={linkForm.supplier_id} onChange={(e) => setLinkForm((f) => ({ ...f, supplier_id: e.target.value }))} style={formInputStyle} data-testid="link-supplier-select">
              <option value="">Seleccionar…</option>
              {activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.internal_code} — {s.trade_name || s.legal_name}</option>)}
            </select>
          </FormField>
          <FormField label="SKU Proveedor">
            <input value={linkForm.supplier_sku} onChange={(e) => setLinkForm((f) => ({ ...f, supplier_sku: e.target.value }))} style={formInputStyle} />
          </FormField>
          <FormField label="Costo Unitario" required>
            <input required type="number" step="0.01" min="0" value={linkForm.unit_cost} onChange={(e) => setLinkForm((f) => ({ ...f, unit_cost: e.target.value }))} style={formInputStyle} data-testid="link-unit-cost-input" />
          </FormField>
          <FormField label="Moneda">
            <select value={linkForm.currency} onChange={(e) => setLinkForm((f) => ({ ...f, currency: e.target.value }))} style={formInputStyle}>
              <option value="USD">USD</option>
              <option value="CLP">CLP</option>
              <option value="ARS">ARS</option>
            </select>
          </FormField>
          <FormField label="Base tributaria">
            <select value={linkForm.tax_basis} onChange={(e) => setLinkForm((f) => ({ ...f, tax_basis: e.target.value }))} style={formInputStyle}>
              <option value="net">Neto</option>
              <option value="tax_included">Imp. incluidos</option>
            </select>
          </FormField>
          <FormField label="MOQ">
            <input type="number" min="1" value={linkForm.moq} onChange={(e) => setLinkForm((f) => ({ ...f, moq: e.target.value }))} style={formInputStyle} />
          </FormField>
          <FormField label="Plazo (días)">
            <input type="number" min="0" value={linkForm.lead_time_days} onChange={(e) => setLinkForm((f) => ({ ...f, lead_time_days: e.target.value }))} style={formInputStyle} />
          </FormField>
          <PrimaryButton type="submit" icon={Plus} loading={saving} data-testid="submit-link-supplier-btn">
            Guardar relación
          </PrimaryButton>
        </form>
      </SectionCard>

      {historyRows.length > 0 && (
        <SectionCard title="Evolución de costos de adquisición" action={<History size={16} color="#71717A" />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historyRows.slice(0, 10).map((h) => (
              <div
                key={h.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#FAFAFA",
                  border: "1px solid #E4E4E7",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: "#09090B", fontWeight: 500 }}>
                  {h.supplier_code} ({h.supplier_name}) · {h.source} · {new Date(h.recorded_at).toLocaleDateString("es-CL")}
                </span>
                <span className="lp-mono" style={{ color: "#0F7A38", fontWeight: 600 }}>
                  {h.previous_cost != null ? `${formatCurrency(h.previous_cost, h.previous_currency || h.new_currency)} → ` : ""}
                  {h.new_cost != null ? `${formatCurrency(h.new_cost, h.new_currency)} ${h.new_currency}` : "Restringido"}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
