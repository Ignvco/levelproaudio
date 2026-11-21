// components/admin/BulkEditModal.jsx — Edición Masiva de Catálogo (BF-15)
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  previewBulkProductsUpdate,
  applyBulkProductsUpdate,
} from "../../api/admin.api"
import { showToast } from "../../utils/toast"
import { Layers, Eye, CheckCircle2, AlertTriangle, X } from "lucide-react"

const bentoInput = {
  width: "100%",
  padding: "10px 12px",
  background: "#121722",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "#F8FAFC",
  fontSize: "13px",
  outline: "none",
}

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

  if (!open) return null

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edición masiva de catálogo"
      data-testid="bulk-edit-modal"
      style={{
        position: "fixed", inset: 0, zIndex: 95,
        background: "rgba(5,7,11,0.82)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}
    >
      <div
        style={{
          width: "min(960px, 100%)", maxHeight: "90vh", overflowY: "auto",
          background: "#0B0E14", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "20px", padding: "24px", color: "#F8FAFC",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", paddingBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#1AFF6E", letterSpacing: "0.14em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
              <Layers size={13} /> Edición Masiva PIM · {selectedIds.length > 0 ? `${selectedIds.length} seleccionados` : "Por filtros activos"}
            </p>
            <h2 style={{ fontSize: "20px", fontWeight: 800, marginTop: "4px" }}>
              Actualización masiva con previsualización y auditoría
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar edición masiva"
            style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Controles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Alcance</label>
            <select value={targetScope} onChange={e => { setTargetScope(e.target.value); setPreview(null) }} style={bentoInput}>
              <option value="products">Productos maestros</option>
              <option value="variants">Variantes de los productos</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Operación</label>
            <select data-testid="bulk-operation-select" value={operation} onChange={e => { setOperation(e.target.value); setPreview(null) }} style={bentoInput}>
              {OPERATIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>

          {(operation === "price_adjust_percent" || operation === "price_set") && (
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Moneda aislada</label>
              <select value={currency} onChange={e => { setCurrency(e.target.value); setPreview(null) }} style={bentoInput}>
                <option value="CLP">CLP (Pesos chilenos)</option>
                <option value="USD">USD (Dólares)</option>
                <option value="ARS">ARS (Pesos argentinos)</option>
              </select>
            </div>
          )}

          {operation === "price_adjust_percent" && (
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Porcentaje (% ej: 10 o -15)</label>
              <input data-testid="bulk-percent-input" type="number" step="0.1" value={percent} onChange={e => { setPercent(e.target.value); setPreview(null) }} style={bentoInput} />
            </div>
          )}

          {operation === "price_set" && (
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Nuevo precio ({currency})</label>
              <input type="number" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); setPreview(null) }} style={bentoInput} />
            </div>
          )}

          {(operation === "stock_set" || operation === "stock_delta") && (
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>
                {operation === "stock_set" ? "Stock exacto" : "Delta (+/- unidades)"}
              </label>
              <input type="number" value={stockVal} onChange={e => { setStockVal(e.target.value); setPreview(null) }} style={bentoInput} />
            </div>
          )}

          {operation === "set_active" && (
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Estado</label>
              <select value={isActiveVal} onChange={e => { setIsActiveVal(e.target.value); setPreview(null) }} style={bentoInput}>
                <option value="true">Activar</option>
                <option value="false">Desactivar</option>
              </select>
            </div>
          )}

          {operation === "set_fields" && (
            <>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Nueva Marca (opcional)</label>
                <select value={brandId} onChange={e => { setBrandId(e.target.value); setPreview(null) }} style={bentoInput}>
                  <option value="">Sin cambio</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Nueva Categoría (opcional)</label>
                <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPreview(null) }} style={bentoInput}>
                  <option value="">Sin cambio</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label style={{ display: "block", fontSize: "11px", color: "#94A3B8", marginBottom: "6px", fontWeight: 600 }}>Política ante errores</label>
            <select value={atomicMode} onChange={e => setAtomicMode(e.target.value)} style={bentoInput}>
              <option value="all_or_nothing">Todo o nada (Rollback si hay error)</option>
              <option value="best_effort">Parcial (Aplica válidos, reporta errores)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="bulk-preview-btn"
            onClick={handlePreview}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 18px", borderRadius: "10px", cursor: "pointer",
              background: "rgba(26,255,110,0.12)", color: "#1AFF6E",
              border: "1px solid rgba(26,255,110,0.35)", fontSize: "13px", fontWeight: 700,
            }}
          >
            <Eye size={15} /> {loading ? "Calculando..." : "Previsualizar cambios"}
          </button>

          {preview && preview.valid_count > 0 && !applyResult && (
            <button
              type="button"
              data-testid="bulk-apply-btn"
              onClick={handleApply}
              disabled={loading}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "10px 20px", borderRadius: "10px", cursor: "pointer",
                background: "#1AFF6E", color: "#0B0E14",
                border: "none", fontSize: "13px", fontWeight: 800,
              }}
            >
              <CheckCircle2 size={15} /> Confirmar y aplicar ({preview.valid_count})
            </button>
          )}
        </div>

        {error && (
          <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: "13px", marginBottom: "14px" }}>
            {error}
          </div>
        )}

        {applyResult && (
          <div data-testid="bulk-apply-result" style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.3)", marginBottom: "16px" }}>
            <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#1AFF6E" }}>
              Estado: {applyResult.status} · Aplicados: {applyResult.applied_count} · Fallidos: {applyResult.failed_count}
            </p>
          </div>
        )}

        {preview && (
          <div data-testid="bulk-preview-table" style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#121722", display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
              <span>Coincidencias: <strong>{preview.total_matched}</strong></span>
              <span style={{ color: "#1AFF6E" }}>Válidos: <strong>{preview.valid_count}</strong></span>
              <span style={{ color: preview.error_count > 0 ? "#F87171" : "#94A3B8" }}>Errores: <strong>{preview.error_count}</strong></span>
              {preview.warnings_count > 0 && (
                <span style={{ color: "#FBBF24", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <AlertTriangle size={12} /> Alertas: {preview.warnings_count}
                </span>
              )}
            </div>

            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", textAlign: "left", color: "#94A3B8" }}>
                    <th style={{ padding: "10px 14px" }}>Registro</th>
                    <th style={{ padding: "10px 14px" }}>SKU</th>
                    <th style={{ padding: "10px 14px" }}>Actual</th>
                    <th style={{ padding: "10px 14px" }}>Propuesto</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map(it => (
                    <tr key={it.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                        {it.name}
                        {it.warnings?.length > 0 && (
                          <p style={{ fontSize: "11px", color: "#FBBF24", marginTop: "2px" }}>{it.warnings.join(" · ")}</p>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", color: "#94A3B8" }}>{it.sku}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", color: "#94A3B8" }}>{JSON.stringify(it.before)}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", color: "#1AFF6E" }}>{JSON.stringify(it.after)}</td>
                    </tr>
                  ))}
                  {preview.errors.map(err => (
                    <tr key={err.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(239,68,68,0.06)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{err.name}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)" }}>{err.sku}</td>
                      <td colSpan={2} style={{ padding: "10px 14px", color: "#FCA5A5" }}>{err.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
