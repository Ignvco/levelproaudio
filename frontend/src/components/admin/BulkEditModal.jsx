// components/admin/BulkEditModal.jsx — Edición Masiva de Catálogo (BF-15) en SideModal Nimbus
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  previewBulkProductsUpdate,
  applyBulkProductsUpdate,
} from "../../api/admin.api"
import { showToast } from "../../utils/toast"
import { Eye, CheckCircle2, AlertTriangle } from "lucide-react"
import {
  SideModal,
  FormField,
  formInputStyle,
  PrimaryButton,
  SecondaryButton,
  CalloutCard,
  StatusBadge,
} from "./ui"

const OPERATIONS = [
  { value: "price_adjust_percent", label: "Ajustar precio (%)" },
  { value: "price_set", label: "Fijar precio exacto" },
  { value: "stock_delta", label: "Ajustar stock (+/-)" },
  { value: "stock_set", label: "Fijar stock exacto" },
  { value: "set_active", label: "Activar / Desactivar" },
  { value: "set_fields", label: "Editar marca / categoría / estado" },
]

export default function BulkEditModal({
  open,
  selectedIds = [],
  filters = {},
  categories = [],
  brands = [],
  onClose,
}) {
  const queryClient = useQueryClient()
  const [operation, setOperation] = useState("price_adjust_percent")
  const [targetScope, setTargetScope] = useState("products")
  const [currency, setCurrency] = useState("CLP")
  const [percent, setPercent] = useState("10")
  const [amount, setAmount] = useState("")
  const [stockVal, setStockVal] = useState("0")
  const [isActiveVal, setIsActiveVal] = useState("true")
  const [brandId, setBrandId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [atomicMode, setAtomicMode] = useState("all_or_nothing")

  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [applyResult, setApplyResult] = useState(null)

  const buildPayload = () => {
    const params = {}
    if (operation === "price_adjust_percent") {
      params.percent = percent
      params.currency = currency
    } else if (operation === "price_set") {
      params.amount = amount
      params.currency = currency
    } else if (operation === "stock_set") {
      params.stock = Number(stockVal)
    } else if (operation === "stock_delta") {
      params.delta = Number(stockVal)
    } else if (operation === "set_active") {
      params.is_active = isActiveVal === "true"
    } else if (operation === "set_fields") {
      params.fields = {}
      if (brandId) params.fields.brand_id = brandId
      if (categoryId) params.fields.category_id = categoryId
    }

    return {
      target_scope: targetScope,
      ...(selectedIds.length > 0 ? { product_ids: selectedIds } : { filters }),
      operation,
      params,
      atomic_mode: atomicMode,
    }
  }

  const handlePreview = async () => {
    setError("")
    setApplyResult(null)
    setLoading(true)
    try {
      const res = await previewBulkProductsUpdate(buildPayload())
      setPreview(res)
    } catch (e) {
      setError(e?.response?.data?.error || "No se pudo previsualizar la edición masiva.")
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    setError("")
    setLoading(true)
    try {
      const idemKey = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const res = await applyBulkProductsUpdate(buildPayload(), idemKey)
      setApplyResult(res)
      queryClient.invalidateQueries({ queryKey: ["admin-products"] })
      showToast(`Edición masiva completada: ${res.applied_count} registros actualizados`)
    } catch (e) {
      setError(e?.response?.data?.error || "Error al aplicar la edición masiva.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SideModal
      open={open}
      onClose={onClose}
      maxWidth={720}
      testId="bulk-edit-modal"
      subtitle={`Catálogo PIM · ${selectedIds.length > 0 ? `${selectedIds.length} seleccionados` : "Por filtros activos"}`}
      title="Edición masiva de catálogo"
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cerrar</SecondaryButton>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SecondaryButton
              icon={Eye}
              onClick={handlePreview}
              loading={loading}
              disabled={loading}
              testId="bulk-preview-btn"
            >
              {loading ? "Calculando..." : "Previsualizar cambios"}
            </SecondaryButton>
            {preview && preview.valid_count > 0 && !applyResult && (
              <PrimaryButton
                icon={CheckCircle2}
                onClick={handleApply}
                loading={loading}
                disabled={loading}
                testId="bulk-apply-btn"
              >
                Confirmar y aplicar ({preview.valid_count})
              </PrimaryButton>
            )}
          </div>
        </>
      }
    >
      {/* Controls Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <FormField label="Alcance">
          <select value={targetScope} onChange={(e) => { setTargetScope(e.target.value); setPreview(null) }} style={formInputStyle}>
            <option value="products">Productos maestros</option>
            <option value="variants">Variantes de los productos</option>
          </select>
        </FormField>

        <FormField label="Operación">
          <select data-testid="bulk-operation-select" value={operation} onChange={(e) => { setOperation(e.target.value); setPreview(null) }} style={formInputStyle}>
            {OPERATIONS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
          </select>
        </FormField>

        {(operation === "price_adjust_percent" || operation === "price_set") && (
          <FormField label="Moneda aislada">
            <select value={currency} onChange={(e) => { setCurrency(e.target.value); setPreview(null) }} style={formInputStyle}>
              <option value="CLP">CLP (Pesos chilenos)</option>
              <option value="USD">USD (Dólares)</option>
              <option value="ARS">ARS (Pesos argentinos)</option>
            </select>
          </FormField>
        )}

        {operation === "price_adjust_percent" && (
          <FormField label="Porcentaje (% ej: 10 o -15)">
            <input data-testid="bulk-percent-input" type="number" step="0.1" value={percent} onChange={(e) => { setPercent(e.target.value); setPreview(null) }} style={formInputStyle} />
          </FormField>
        )}

        {operation === "price_set" && (
          <FormField label={`Nuevo precio (${currency})`}>
            <input type="number" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setPreview(null) }} style={formInputStyle} />
          </FormField>
        )}

        {(operation === "stock_set" || operation === "stock_delta") && (
          <FormField label={operation === "stock_set" ? "Stock exacto" : "Delta (+/- unidades)"}>
            <input type="number" value={stockVal} onChange={(e) => { setStockVal(e.target.value); setPreview(null) }} style={formInputStyle} />
          </FormField>
        )}

        {operation === "set_active" && (
          <FormField label="Estado">
            <select value={isActiveVal} onChange={(e) => { setIsActiveVal(e.target.value); setPreview(null) }} style={formInputStyle}>
              <option value="true">Activar</option>
              <option value="false">Desactivar</option>
            </select>
          </FormField>
        )}

        {operation === "set_fields" && (
          <>
            <FormField label="Nueva Marca (opcional)">
              <select value={brandId} onChange={(e) => { setBrandId(e.target.value); setPreview(null) }} style={formInputStyle}>
                <option value="">Sin cambio</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FormField>
            <FormField label="Nueva Categoría (opcional)">
              <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPreview(null) }} style={formInputStyle}>
                <option value="">Sin cambio</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </>
        )}

        <FormField label="Política ante errores">
          <select value={atomicMode} onChange={(e) => setAtomicMode(e.target.value)} style={formInputStyle}>
            <option value="all_or_nothing">Todo o nada (Rollback si hay error)</option>
            <option value="best_effort">Parcial (Aplica válidos, reporta errores)</option>
          </select>
        </FormField>
      </div>

      {error && <CalloutCard tone="danger" description={error} />}

      {applyResult && (
        <CalloutCard
          tone="success"
          testId="bulk-apply-result"
          title="Edición masiva aplicada"
          description={`Estado: ${applyResult.status} · Aplicados: ${applyResult.applied_count} · Fallidos: ${applyResult.failed_count}`}
        />
      )}

      {preview && (
        <div
          data-testid="bulk-preview-table"
          className="au-card au-table-wrap"
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: "#FAFAFA",
              borderBottom: "1px solid #E4E4E7",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span>Coincidencias: <strong>{preview.total_matched}</strong></span>
            <StatusBadge tone="success">Válidos: {preview.valid_count}</StatusBadge>
            <StatusBadge tone={preview.error_count > 0 ? "danger" : "neutral"}>
              Errores: {preview.error_count}
            </StatusBadge>
            {preview.warnings_count > 0 && (
              <span style={{ color: "#B45309", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
                <AlertTriangle size={13} /> Alertas: {preview.warnings_count}
              </span>
            )}
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto" }} className="au-tscroll">
            <table className="au-table">
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>SKU</th>
                  <th>Actual</th>
                  <th>Propuesto</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((it) => (
                  <tr key={it.id}>
                    <td style={{ fontWeight: 600, color: "#09090B" }}>
                      {it.name}
                      {it.warnings?.length > 0 && (
                        <p style={{ fontSize: 11.5, color: "#B45309", margin: "2px 0 0", fontWeight: 500 }}>
                          {it.warnings.join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="lp-mono">{it.sku}</td>
                    <td className="lp-mono" style={{ fontSize: 12, color: "#71717A" }}>{JSON.stringify(it.before)}</td>
                    <td className="lp-mono" style={{ fontSize: 12, color: "#0F7A38", fontWeight: 600 }}>{JSON.stringify(it.after)}</td>
                  </tr>
                ))}
                {preview.errors.map((err) => (
                  <tr key={err.id} style={{ background: "#FEF2F2" }}>
                    <td style={{ fontWeight: 600, color: "#09090B" }}>{err.name}</td>
                    <td className="lp-mono">{err.sku}</td>
                    <td colSpan={2} style={{ color: "#DC2626" }}>{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SideModal>
  )
}
