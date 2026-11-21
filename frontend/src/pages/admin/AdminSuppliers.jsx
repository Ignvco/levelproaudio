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
  background: "#0B0E14",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "#F8FAFC",
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
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <SecondaryButton size="sm" onClick={() => { setImportResult(null); setShowImportModal(true) }} data-testid="open-price-list-import-btn">
              <Upload size={14} /> Importar costos
            </SecondaryButton>
            <a
              href={getSupplierPriceListsExportUrl("xlsx")}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "7px 12px", borderRadius: "10px", fontSize: "12.5px", fontWeight: 600,
                background: "rgba(255,255,255,0.06)", color: "#E2E8F0",
                border: "1px solid rgba(255,255,255,0.1)", textDecoration: "none",
              }}
            >
              <Download size={14} /> Exportar XLSX
            </a>
            <PrimaryButton size="sm" onClick={() => setShowCreateModal(true)} data-testid="new-supplier-btn">
              <Plus size={14} /> Nuevo proveedor
            </PrimaryButton>
          </div>
        }
      />

      {/* KPIs operativos reales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        {[
          { label: "Proveedores activos", value: summary.active, sub: `${summary.national} nacionales · ${summary.international} int.`, Icon: Building2, tone: "#1AFF6E" },
          { label: "Cobertura internacional", value: summary.international, sub: "Fabricantes / Importadores USD-ARS", Icon: Globe2, tone: "#38BDF8" },
          { label: "SKUs vinculados", value: summary.linked_skus, sub: "Relaciones activas catálogo ↔ proveedor", Icon: PackageCheck, tone: "#A78BFA" },
          { label: "Listas vencidas", value: summary.expired_lists, sub: summary.expired_lists > 0 ? "Requieren actualización de costo" : "Todas vigentes", Icon: AlertTriangle, tone: summary.expired_lists > 0 ? "#F59E0B" : "#1AFF6E" },
        ].map(({ label, value, sub, Icon, tone }) => (
          <div key={label} style={{
            padding: "16px 18px", borderRadius: "16px",
            background: "#121722", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <Icon size={16} color={tone} />
            </div>
            <p style={{ fontSize: "26px", fontWeight: 800, color: "#F8FAFC", fontFamily: "var(--font-mono)", lineHeight: 1.1 }}>{value}</p>
            <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "6px" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <SectionCard eyebrow="DIRECTORIO" title="Filtros de búsqueda">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "11px", top: "12px", color: "#64748B" }} />
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
            <p style={{ color: "#94A3B8", fontSize: "13px" }}>Cargando directorio de proveedores…</p>
          ) : isError ? (
            <p style={{ color: "#F87171", fontSize: "13px" }}>Error al cargar proveedores. Verifica tus permisos.</p>
          ) : suppliers.length === 0 ? (
            <p style={{ color: "#94A3B8", fontSize: "13px" }}>No se encontraron proveedores para los filtros aplicados.</p>
          ) : (
            <table data-testid="suppliers-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8", fontSize: "11px", textTransform: "uppercase", textAlign: "left" }}>
                  <th style={{ padding: "10px 8px" }}>Código</th>
                  <th style={{ padding: "10px 8px" }}>Proveedor</th>
                  <th style={{ padding: "10px 8px" }}>Tipo / País</th>
                  <th style={{ padding: "10px 8px" }}>Moneda</th>
                  <th style={{ padding: "10px 8px" }}>Plazo / MOQ</th>
                  <th style={{ padding: "10px 8px" }}>Marcas</th>
                  <th style={{ padding: "10px 8px" }}>SKUs</th>
                  <th style={{ padding: "10px 8px" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr
                    key={s.id}
                    data-testid={`supplier-row-${s.internal_code}`}
                    onClick={() => navigate(`/admin/suppliers/${s.id}`)}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                  >
                    <td style={{ padding: "12px 8px", fontFamily: "var(--font-mono)", color: "#1AFF6E", fontWeight: 700 }}>{s.internal_code}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <p style={{ fontWeight: 700, color: "#F8FAFC" }}>{s.trade_name || s.legal_name}</p>
                      <p style={{ fontSize: "11.5px", color: "#94A3B8" }}>{s.legal_name} {s.tax_id ? `· ${s.tax_id}` : ""}</p>
                    </td>
                    <td style={{ padding: "12px 8px", color: "#CBD5E1" }}>
                      {SUPPLIER_TYPES[s.supplier_type] || s.supplier_type} · {s.country}
                    </td>
                    <td style={{ padding: "12px 8px", fontFamily: "var(--font-mono)", color: "#F8FAFC" }}>{s.currency}</td>
                    <td style={{ padding: "12px 8px", fontFamily: "var(--font-mono)", color: "#CBD5E1" }}>
                      {s.default_lead_time_days}d · MOQ {s.default_min_order_qty}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {(s.brands_detail || []).slice(0, 3).map(b => (
                          <span key={b.id} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "999px", background: "rgba(255,255,255,0.07)", color: "#E2E8F0" }}>{b.name}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px", fontFamily: "var(--font-mono)", color: "#F8FAFC" }}>{s.linked_products_count ?? 0}</td>
                    <td style={{ padding: "12px 8px" }}>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "16px" }}>
          <form onSubmit={handleCreateSupplier} data-testid="create-supplier-modal" style={{ width: "100%", maxWidth: "620px", background: "#121722", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "18px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#F8FAFC" }}>Nuevo Proveedor</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Código interno (opcional)</label>
                <input data-testid="new-supplier-code" value={newSupplier.internal_code} onChange={e => setNewSupplier(s => ({ ...s, internal_code: e.target.value }))} placeholder="Auto (SUP-XXXX)" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Identificación tributaria</label>
                <input value={newSupplier.tax_id} onChange={e => setNewSupplier(s => ({ ...s, tax_id: e.target.value }))} placeholder="RUT / CUIT / EIN" style={bentoInput} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Razón social *</label>
                <input data-testid="new-supplier-legal-name" required value={newSupplier.legal_name} onChange={e => setNewSupplier(s => ({ ...s, legal_name: e.target.value }))} placeholder="Ej: Audio Distribuidora SpA" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Nombre comercial</label>
                <input value={newSupplier.trade_name} onChange={e => setNewSupplier(s => ({ ...s, trade_name: e.target.value }))} placeholder="Ej: ProAudio Latam" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>País</label>
                <input value={newSupplier.country} onChange={e => setNewSupplier(s => ({ ...s, country: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Tipo</label>
                <select value={newSupplier.supplier_type} onChange={e => setNewSupplier(s => ({ ...s, supplier_type: e.target.value }))} style={bentoInput}>
                  {Object.entries(SUPPLIER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Moneda comercial</label>
                <select value={newSupplier.currency} onChange={e => setNewSupplier(s => ({ ...s, currency: e.target.value }))} style={bentoInput}>
                  <option value="USD">USD</option>
                  <option value="CLP">CLP</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Condiciones de pago</label>
                <input value={newSupplier.payment_terms} onChange={e => setNewSupplier(s => ({ ...s, payment_terms: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Plazo habitual (días)</label>
                <input type="number" min="0" value={newSupplier.default_lead_time_days} onChange={e => setNewSupplier(s => ({ ...s, default_lead_time_days: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Email</label>
                <input type="email" value={newSupplier.primary_email} onChange={e => setNewSupplier(s => ({ ...s, primary_email: e.target.value }))} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8" }}>Teléfono</label>
                <input value={newSupplier.primary_phone} onChange={e => setNewSupplier(s => ({ ...s, primary_phone: e.target.value }))} style={bentoInput} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px" }}>
              <SecondaryButton type="button" onClick={() => setShowCreateModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" loading={creating} data-testid="submit-create-supplier-btn">Crear proveedor</PrimaryButton>
            </div>
          </form>
        </div>
      )}

      {/* Modal Importar Listas de Costos */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "16px" }}>
          <div data-testid="price-list-import-modal" style={{ width: "100%", maxWidth: "660px", background: "#121722", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "18px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#F8FAFC" }}>Importación de Listas de Costos (Excel / CSV)</h3>
              <button type="button" onClick={() => setShowImportModal(false)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "12.5px", color: "#94A3B8", marginBottom: "14px" }}>
              Actualiza costos de proveedores sin alterar precios de venta ni stock físico. Descarga la{" "}
              <a href={getSupplierPriceListTemplateUrl("csv")} style={{ color: "#1AFF6E" }}>plantilla CSV</a> o{" "}
              <a href={getSupplierPriceListTemplateUrl("xlsx")} style={{ color: "#1AFF6E" }}>XLSX</a>.
            </p>
            <input type="file" accept=".csv,.xlsx" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{ color: "#E2E8F0", fontSize: "13px", marginBottom: "14px" }} />
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <SecondaryButton onClick={() => handleRunImport(true)} loading={importing} data-testid="import-price-dry-run-btn">Simular (Dry-Run)</SecondaryButton>
              <PrimaryButton onClick={() => handleRunImport(false)} loading={importing} data-testid="import-price-confirm-btn">Confirmar importación</PrimaryButton>
            </div>
            {importResult && (
              <div data-testid="import-price-summary" style={{ padding: "12px", borderRadius: "12px", background: "#0B0E14", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "220px", overflowY: "auto" }}>
                <p style={{ fontSize: "12.5px", color: "#F8FAFC", fontWeight: 700, marginBottom: "6px" }}>
                  {importResult.dry_run ? "Simulación:" : "Aplicado:"} {importResult.summary.new} nuevos · {importResult.summary.updated} actualizados · {importResult.summary.rejected} rechazados
                </p>
                {(importResult.errors || []).map(err => (
                  <p key={err.row} style={{ fontSize: "11.5px", color: "#F87171" }}>Fila {err.row} ({err.sku}): {err.error}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
