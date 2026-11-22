// pages/admin/AdminSuppliers.jsx — Directorio Empresarial de Proveedores (Gate 3: BF-01 & BF-02)
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAdminSuppliers,
  createAdminSupplier,
  importSupplierPriceLists,
  getSupplierPriceListsExportUrl,
  getSupplierPriceListTemplateUrl,
} from "../../api/suppliers.api"
import { AdminPageHeader, SectionCard, PrimaryButton, SecondaryButton, StatusBadge } from "../../components/admin/ui"
import { showToast } from "../../utils/toast"
import { Plus, Search, Upload, Download, Building2, Globe2, PackageCheck, AlertTriangle, X } from "lucide-react"

const bentoInput = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--admin-surface, #FFFFFF)",
  border: "1px solid var(--admin-border, #CBD5E1)",
  borderRadius: "10px",
  color: "var(--admin-text, #14161A)",
  fontSize: "13px",
  outline: "none",
}

const SUPPLIER_TYPES = {
  manufacturer: "Fabricante",
  importer: "Importador",
  distributor: "Distribuidor",
  wholesaler: "Mayorista",
}

export default function AdminSuppliers() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [currencyFilter, setCurrencyFilter] = useState("")
  const [activeFilter, setActiveFilter] = useState("true")

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    internal_code: "",
    legal_name: "",
    trade_name: "",
    tax_id: "",
    country: "Chile",
    supplier_type: "distributor",
    currency: "USD",
    payment_terms: "30 días",
    default_min_order_qty: "1",
    default_lead_time_days: "7",
    primary_email: "",
    primary_phone: "",
  })

  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-suppliers", search, typeFilter, currencyFilter, activeFilter],
    queryFn: () => getAdminSuppliers({
      search: search || undefined,
      supplier_type: typeFilter || undefined,
      currency: currencyFilter || undefined,
      is_active: activeFilter !== "" ? activeFilter : undefined,
    }),
  })

  const suppliers = data?.results || []
  const summary = data?.summary || { active: 0, national: 0, international: 0, linked_skus: 0, expired_lists: 0 }

  const handleCreateSupplier = async (e) => {
    e.preventDefault()
    if (!newSupplier.legal_name.trim()) {
      showToast("La razón social es obligatoria", "error")
      return
    }
    setCreating(true)
    try {
      const created = await createAdminSupplier({
        ...newSupplier,
        default_min_order_qty: Number(newSupplier.default_min_order_qty) || 1,
        default_lead_time_days: Number(newSupplier.default_lead_time_days) || 7,
      })
      showToast("Proveedor creado correctamente")
      setShowCreateModal(false)
      setNewSupplier({
        internal_code: "", legal_name: "", trade_name: "", tax_id: "",
        country: "Chile", supplier_type: "distributor", currency: "USD",
        payment_terms: "30 días", default_min_order_qty: "1", default_lead_time_days: "7",
        primary_email: "", primary_phone: "",
      })
      queryClient.invalidateQueries({ queryKey: ["admin-suppliers"] })
      navigate(`/admin/suppliers/${created.id}`)
    } catch (err) {
      showToast(err?.response?.data?.error ? JSON.stringify(err.response.data.error) : "Error al crear proveedor", "error")
    } finally {
      setCreating(false)
    }
  }

  const handleRunImport = async (dryRun) => {
    if (!importFile) {
      showToast("Selecciona un archivo .xlsx o .csv", "error")
      return
    }
    setImporting(true)
    try {
      const res = await importSupplierPriceLists(importFile, { dryRun })
      setImportResult(res)
      if (!dryRun) {
        showToast(`Importación aplicada: ${res.summary.new} nuevos, ${res.summary.updated} actualizados`)
        refetch()
      } else {
        showToast("Simulación dry-run completada")
      }
    } catch (err) {
      showToast(err?.response?.data?.error || "Error al procesar lista de costos", "error")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO PROCUREMENT / GATE 3"
        title="Proveedores y Listas de Costos"
        description="Directorio de fabricantes, importadores y distribuidores pro-audio con comparación multi-moneda por SKU."
        actions={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <SecondaryButton size="sm" onClick={() => { setImportResult(null); setShowImportModal(true) }} data-testid="open-price-list-import-btn">
              <Upload size={14} /> Importar costos
            </SecondaryButton>
            <a
              href={getSupplierPriceListsExportUrl("xlsx")}
              className="au-btn au-btn--secondary au-btn--sm"
              style={{ textDecoration: "none" }}
            >
              <Download size={14} /> Exportar XLSX
            </a>
            <PrimaryButton size="sm" onClick={() => setShowCreateModal(true)} data-testid="new-supplier-btn">
              <Plus size={14} /> Nuevo proveedor
            </PrimaryButton>
          </div>
        }
      />

      {/* KPIs operativos oficiales Bento */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        {[
          { label: "Proveedores activos", value: summary.active, sub: `${summary.national} nacionales · ${summary.international} int.`, Icon: Building2, tone: "#0F9940" },
          { label: "Cobertura internacional", value: summary.international, sub: "Fabricantes / Importadores USD-ARS", Icon: Globe2, tone: "#0284C7" },
          { label: "SKUs vinculados", value: summary.linked_skus, sub: "Relaciones activas catálogo ↔ proveedor", Icon: PackageCheck, tone: "#7C3AED" },
          { label: "Listas vencidas", value: summary.expired_lists, sub: summary.expired_lists > 0 ? "Requieren actualización de costo" : "Todas vigentes", Icon: AlertTriangle, tone: summary.expired_lists > 0 ? "#D97706" : "#0F9940" },
        ].map(({ label, value, sub, Icon, tone }) => (
          <div key={label} style={{
            padding: "18px 20px", borderRadius: "var(--admin-radius-lg, 20px)",
            background: "var(--admin-surface, #FFFFFF)", border: "1px solid var(--admin-border, #ECEEF2)",
            boxShadow: "var(--admin-shadow-sm, 0 4px 14px rgba(20,30,24,0.05))",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--admin-text-muted, #475569)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <span style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--admin-surface-secondary, #F1F5F9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={16} color={tone} />
              </span>
            </div>
            <p style={{ fontSize: "28px", fontWeight: 850, color: "var(--admin-text, #14161A)", fontFamily: "var(--font-mono)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value}</p>
            <p style={{ fontSize: "12px", color: "var(--admin-text-muted, #475569)", marginTop: "6px", fontWeight: 500 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <SectionCard eyebrow="DIRECTORIO" title="Filtros de búsqueda">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "11px", top: "12px", color: "var(--admin-text-muted, #64748B)" }} />
            <input
              data-testid="supplier-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Código, razón social, RUT/CUIT, país…"
              style={{ ...bentoInput, paddingLeft: "32px" }}
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={bentoInput}>
            <option value="">Todos los tipos</option>
            {Object.entries(SUPPLIER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} style={bentoInput}>
            <option value="">Todas las monedas</option>
            <option value="USD">USD</option>
            <option value="CLP">CLP</option>
            <option value="ARS">ARS</option>
          </select>
          <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} style={bentoInput}>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
            <option value="">Todos los estados</option>
          </select>
        </div>

        <div style={{ marginTop: "18px", overflowX: "auto" }}>
          {isLoading ? (
            <p style={{ color: "var(--admin-text-muted, #475569)", fontSize: "13px" }}>Cargando directorio de proveedores…</p>
          ) : isError ? (
            <p style={{ color: "#DC2626", fontSize: "13px", fontWeight: 600 }}>Error al cargar proveedores. Verifica tus permisos.</p>
          ) : suppliers.length === 0 ? (
            <p style={{ color: "var(--admin-text-muted, #475569)", fontSize: "13px" }}>No se encontraron proveedores para los filtros aplicados.</p>
          ) : (
            <table className="au-table" data-testid="suppliers-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Proveedor</th>
                  <th>Tipo / País</th>
                  <th>Moneda</th>
                  <th>Plazo / MOQ</th>
                  <th>Marcas</th>
                  <th>SKUs</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr
                    key={s.id}
                    data-testid={`supplier-row-${s.internal_code}`}
                    onClick={() => navigate(`/admin/suppliers/${s.id}`)}
                    style={{ cursor: "pointer", opacity: s.is_active ? 1 : 0.68 }}
                  >
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-primary-text, #0F9940)", fontWeight: 700 }}>{s.internal_code}</td>
                    <td>
                      <p style={{ fontWeight: 700, color: "var(--admin-text, #14161A)" }}>{s.trade_name || s.legal_name}</p>
                      <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted, #475569)" }}>{s.legal_name} {s.tax_id ? `· ${s.tax_id}` : ""}</p>
                    </td>
                    <td style={{ color: "var(--admin-text, #14161A)" }}>
                      {SUPPLIER_TYPES[s.supplier_type] || s.supplier_type} · {s.country}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text, #14161A)" }}>{s.currency}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text, #14161A)" }}>
                      {s.default_lead_time_days}d · MOQ {s.default_min_order_qty}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {(s.brands_detail || []).slice(0, 3).map(b => (
                          <span key={b.id} style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px", background: "var(--admin-surface-secondary, #F1F5F9)", border: "1px solid var(--admin-border, #CBD5E1)", color: "var(--admin-text, #14161A)" }}>{b.name}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--admin-text, #14161A)" }}>{s.linked_products_count ?? 0}</td>
                    <td>
                      <StatusBadge tone={s.is_active ? "success" : "danger"}>
                        {s.is_active ? "Activo" : "Inactivo"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      {/* Modal Crear Proveedor */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,13,15,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "16px" }}>
          <form onSubmit={handleCreateSupplier} data-testid="create-supplier-modal" style={{ width: "100%", maxWidth: "620px", background: "#FFFFFF", border: "1px solid var(--admin-border, #ECEEF2)", borderRadius: "var(--admin-radius-lg, 24px)", boxShadow: "0 24px 60px rgba(20,30,24,0.24)", padding: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--admin-text, #14161A)" }}>Nuevo Proveedor</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "var(--admin-text-muted, #6B7280)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Código interno (opcional)</label>
                <input data-testid="new-supplier-code" value={newSupplier.internal_code} onChange={e => setNewSupplier(s => ({ ...s, internal_code: e.target.value }))} placeholder="Auto (SUP-XXXX)" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Identificación tributaria</label>
                <input value={newSupplier.tax_id} onChange={e => setNewSupplier(s => ({ ...s, tax_id: e.target.value }))} placeholder="RUT / CUIT / EIN" style={bentoInput} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Razón social *</label>
                <input data-testid="new-supplier-legal-name" required value={newSupplier.legal_name} onChange={e => setNewSupplier(s => ({ ...s, legal_name: e.target.value }))} placeholder="Ej: Audio Distribuidora SpA" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Nombre comercial</label>
                <input value={newSupplier.trade_name} onChange={e => setNewSupplier(s => ({ ...s, trade_name: e.target.value }))} placeholder="Ej: ProAudio Latam" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>País</label>
                <input value={newSupplier.country} onChange={e => setNewSupplier(s => ({ ...s, country: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Tipo</label>
                <select value={newSupplier.supplier_type} onChange={e => setNewSupplier(s => ({ ...s, supplier_type: e.target.value }))} style={bentoInput}>
                  {Object.entries(SUPPLIER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Moneda comercial</label>
                <select value={newSupplier.currency} onChange={e => setNewSupplier(s => ({ ...s, currency: e.target.value }))} style={bentoInput}>
                  <option value="USD">USD</option>
                  <option value="CLP">CLP</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Condiciones de pago</label>
                <input value={newSupplier.payment_terms} onChange={e => setNewSupplier(s => ({ ...s, payment_terms: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Plazo habitual (días)</label>
                <input type="number" min="0" value={newSupplier.default_lead_time_days} onChange={e => setNewSupplier(s => ({ ...s, default_lead_time_days: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Email</label>
                <input type="email" value={newSupplier.primary_email} onChange={e => setNewSupplier(s => ({ ...s, primary_email: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Teléfono</label>
                <input value={newSupplier.primary_phone} onChange={e => setNewSupplier(s => ({ ...s, primary_phone: e.target.value }))} style={bentoInput} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <SecondaryButton type="button" onClick={() => setShowCreateModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" loading={creating} data-testid="submit-create-supplier-btn">Crear proveedor</PrimaryButton>
            </div>
          </form>
        </div>
      )}

      {/* Modal Importar Listas de Costos */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,13,15,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "16px" }}>
          <div data-testid="price-list-import-modal" style={{ width: "100%", maxWidth: "660px", background: "#FFFFFF", border: "1px solid var(--admin-border, #ECEEF2)", borderRadius: "var(--admin-radius-lg, 24px)", boxShadow: "0 24px 60px rgba(20,30,24,0.24)", padding: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--admin-text, #14161A)" }}>Importación de Listas de Costos (Excel / CSV)</h3>
              <button type="button" onClick={() => setShowImportModal(false)} style={{ background: "none", border: "none", color: "var(--admin-text-muted, #6B7280)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--admin-text-muted, #475569)", marginBottom: "14px", lineHeight: 1.5 }}>
              Actualiza costos de proveedores sin alterar precios de venta ni stock físico. Descarga la{" "}
              <a href={getSupplierPriceListTemplateUrl("csv")} style={{ color: "var(--admin-primary-text, #0F9940)", fontWeight: 700, textDecoration: "underline" }}>plantilla CSV</a> o{" "}
              <a href={getSupplierPriceListTemplateUrl("xlsx")} style={{ color: "var(--admin-primary-text, #0F9940)", fontWeight: 700, textDecoration: "underline" }}>XLSX</a>.
            </p>
            <div style={{ padding: "14px", borderRadius: "12px", background: "var(--admin-surface-secondary, #F8FAFC)", border: "1px solid var(--admin-border, #CBD5E1)", marginBottom: "16px" }}>
              <input type="file" accept=".csv,.xlsx" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{ color: "var(--admin-text, #14161A)", fontSize: "13px", width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <SecondaryButton onClick={() => handleRunImport(true)} loading={importing} data-testid="import-price-dry-run-btn">Simular (Dry-Run)</SecondaryButton>
              <PrimaryButton onClick={() => handleRunImport(false)} loading={importing} data-testid="import-price-confirm-btn">Confirmar importación</PrimaryButton>
            </div>
            {importResult && (
              <div data-testid="import-price-summary" style={{ padding: "14px", borderRadius: "12px", background: "var(--admin-surface-secondary, #F8FAFC)", border: "1px solid var(--admin-border, #CBD5E1)", maxHeight: "220px", overflowY: "auto" }}>
                <p style={{ fontSize: "13px", color: "var(--admin-text, #14161A)", fontWeight: 700, marginBottom: "8px" }}>
                  {importResult.dry_run ? "Simulación:" : "Aplicado:"} {importResult.summary.new} nuevos · {importResult.summary.updated} actualizados · {importResult.summary.rejected} rechazados
                </p>
                {(importResult.errors || []).map(err => (
                  <p key={err.row} style={{ fontSize: "12px", color: "#DC2626", fontWeight: 600, marginTop: "4px" }}>Fila {err.row} ({err.sku}): {err.error}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
