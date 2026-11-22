// pages/admin/AdminSupplierDetail.jsx — Ficha Empresarial de Proveedor (Gate 3)
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  getAdminSupplier,
  updateAdminSupplier,
  deactivateAdminSupplier,
  reactivateAdminSupplier,
  createAdminSupplierContact,
  deleteAdminSupplierContact,
  getAdminSupplierProducts,
  getAdminSupplierPriceHistory,
  getSupplierPriceListsExportUrl,
} from "../../api/suppliers.api"
import { getAdminBrands } from "../../api/admin.api"
import { AdminPageHeader, SectionCard, PrimaryButton, SecondaryButton, StatusBadge } from "../../components/admin/ui"
import { showToast } from "../../utils/toast"
import { formatCurrency } from "../../utils/accountingCurrency"
import { Save, UserPlus, Trash2, Download, Building2, Users, Package, History } from "lucide-react"

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

export default function AdminSupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState("profile")

  const { data: supplier, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-supplier-detail", id],
    queryFn: () => getAdminSupplier(id),
    enabled: !!id,
  })
  const { data: brandsData } = useQuery({ queryKey: ["admin-brands"], queryFn: () => getAdminBrands() })
  const { data: productsData } = useQuery({
    queryKey: ["admin-supplier-products", id],
    queryFn: () => getAdminSupplierProducts(id),
    enabled: !!id,
  })
  const { data: historyData } = useQuery({
    queryKey: ["admin-supplier-history", id],
    queryFn: () => getAdminSupplierPriceHistory(id),
    enabled: !!id,
  })

  const brands = Array.isArray(brandsData) ? brandsData : brandsData?.results || []
  const linkedProducts = productsData?.results || []
  const historyRows = historyData?.results || []

  const [form, setForm] = useState(null)
  const [selectedBrandIds, setSelectedBrandIds] = useState([])
  const [saving, setSaving] = useState(false)

  const [contactForm, setContactForm] = useState({ full_name: "", role_title: "", email: "", phone: "" })
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    if (!supplier) return
    setForm({
      legal_name: supplier.legal_name || "",
      trade_name: supplier.trade_name || "",
      tax_id: supplier.tax_id || "",
      country: supplier.country || "",
      address: supplier.address || "",
      website: supplier.website || "",
      primary_email: supplier.primary_email || "",
      primary_phone: supplier.primary_phone || "",
      supplier_type: supplier.supplier_type || "distributor",
      currency: supplier.currency || "USD",
      payment_terms: supplier.payment_terms || "",
      default_min_order_qty: String(supplier.default_min_order_qty ?? 1),
      default_lead_time_days: String(supplier.default_lead_time_days ?? 7),
      internal_notes: supplier.internal_notes || "",
    })
    setSelectedBrandIds((supplier.brands_detail || []).map(b => b.id))
  }, [supplier])

  const handleSaveProfile = async () => {
    if (!form) return
    setSaving(true)
    try {
      await updateAdminSupplier(id, {
        ...form,
        default_min_order_qty: Number(form.default_min_order_qty) || 1,
        default_lead_time_days: Number(form.default_lead_time_days) || 0,
        brand_ids: selectedBrandIds,
      })
      showToast("Proveedor actualizado")
      refetch()
    } catch {
      showToast("Error al guardar cambios del proveedor", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!supplier) return
    try {
      if (supplier.is_active) {
        if (!window.confirm("¿Desactivar lógicamente este proveedor? Su historial y relaciones se conservarán.")) return
        await deactivateAdminSupplier(id)
        showToast("Proveedor desactivado lógicamente")
      } else {
        await reactivateAdminSupplier(id)
        showToast("Proveedor reactivado")
      }
      refetch()
    } catch {
      showToast("No se pudo cambiar el estado del proveedor", "error")
    }
  }

  const handleAddContact = async (e) => {
    e.preventDefault()
    if (!contactForm.full_name.trim()) return
    setSavingContact(true)
    try {
      await createAdminSupplierContact(id, contactForm)
      setContactForm({ full_name: "", role_title: "", email: "", phone: "" })
      refetch()
      showToast("Contacto agregado")
    } catch {
      showToast("Error al agregar contacto", "error")
    } finally {
      setSavingContact(false)
    }
  }

  const handleDeleteContact = async (contactId) => {
    try {
      await deleteAdminSupplierContact(id, contactId)
      refetch()
      showToast("Contacto eliminado")
    } catch {
      showToast("Error al eliminar contacto", "error")
    }
  }

  if (isLoading) return <div className="au-page"><p style={{ color: "var(--admin-text-muted, #475569)" }}>Cargando ficha de proveedor…</p></div>
  if (isError || !supplier || !form) return (
    <div className="au-page">
      <p style={{ color: "#DC2626", fontWeight: 600 }}>Proveedor no encontrado.</p>
      <SecondaryButton onClick={() => navigate("/admin/suppliers")}>← Volver a Proveedores</SecondaryButton>
    </div>
  )

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow={`PROVEEDOR / ${supplier.internal_code}`}
        title={supplier.trade_name || supplier.legal_name}
        description={`${supplier.legal_name} · ${supplier.country} · Moneda ${supplier.currency}`}
        breadcrumbs={[
          { label: "Proveedores", to: "/admin/suppliers" },
          { label: supplier.internal_code },
        ]}
        actions={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <SecondaryButton size="sm" onClick={() => navigate(`/admin/procurement?supplier=${id}`)}>
              Ver Órdenes de Compra
            </SecondaryButton>
            <a
              href={getSupplierPriceListsExportUrl("xlsx", id)}
              className="au-btn au-btn--secondary au-btn--sm"
              style={{ textDecoration: "none" }}
            >
              <Download size={14} /> Exportar lista
            </a>
            <button
              type="button"
              onClick={handleToggleActive}
              data-testid="toggle-supplier-active-btn"
              className={`au-btn au-btn--sm ${supplier.is_active ? "au-btn--danger" : "au-btn--primary"}`}
            >
              {supplier.is_active ? "Desactivar proveedor" : "Reactivar proveedor"}
            </button>
          </div>
        }
      />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {[
          { key: "profile", label: "Ficha & Condiciones", Icon: Building2 },
          { key: "contacts", label: `Contactos (${supplier.contacts?.length || 0})`, Icon: Users },
          { key: "products", label: `Productos Vinculados (${linkedProducts.length})`, Icon: Package },
          { key: "history", label: `Historial de Costos (${historyRows.length})`, Icon: History },
        ].map(({ key, label, Icon }) => {
          const isActive = tab === key
          return (
            <button
              key={key}
              type="button"
              data-testid={`supplier-tab-${key}`}
              onClick={() => setTab(key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", borderRadius: "100px", cursor: "pointer",
                fontSize: "13px", fontWeight: isActive ? 700 : 600,
                background: isActive ? "var(--admin-primary, #1AFF6E)" : "var(--admin-surface, #FFFFFF)",
                color: isActive ? "#00160B" : "var(--admin-text, #14161A)",
                border: isActive ? "1px solid transparent" : "1px solid var(--admin-border, #CBD5E1)",
                boxShadow: isActive ? "0 4px 14px rgba(26,255,110,0.3)" : "var(--admin-shadow-sm, 0 2px 8px rgba(0,0,0,0.04))",
                transition: "all 0.18s ease",
              }}
            >
              <Icon size={14} color={isActive ? "#00160B" : "var(--admin-text-muted, #475569)"} /> {label}
            </button>
          )
        })}
      </div>

      {tab === "profile" && (
        <SectionCard
          title="Información general y marcas distribuidas"
          action={
            <PrimaryButton onClick={handleSaveProfile} loading={saving} data-testid="save-supplier-profile-btn">
              <Save size={14} /> Guardar cambios
            </PrimaryButton>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Razón social</label>
              <input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Nombre comercial</label>
              <input value={form.trade_name} onChange={e => setForm(f => ({ ...f, trade_name: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Identificación tributaria</label>
              <input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>País</label>
              <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Moneda comercial</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={bentoInput}>
                <option value="USD">USD</option>
                <option value="CLP">CLP</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Condiciones de pago</label>
              <input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>MOQ habitual</label>
              <input type="number" min="1" value={form.default_min_order_qty} onChange={e => setForm(f => ({ ...f, default_min_order_qty: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Plazo habitual (días)</label>
              <input type="number" min="0" value={form.default_lead_time_days} onChange={e => setForm(f => ({ ...f, default_lead_time_days: e.target.value }))} style={bentoInput} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "6px" }}>Marcas distribuidas</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {brands.map(b => {
                  const checked = selectedBrandIds.includes(b.id)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBrandIds(prev => checked ? prev.filter(x => x !== b.id) : [...prev, b.id])}
                      style={{
                        padding: "6px 14px", borderRadius: "999px", fontSize: "12px", cursor: "pointer",
                        background: checked ? "rgba(15,153,64,0.12)" : "var(--admin-surface-secondary, #F1F5F9)",
                        color: checked ? "#0F9940" : "var(--admin-text, #14161A)",
                        border: `1.5px solid ${checked ? "#0F9940" : "var(--admin-border, #CBD5E1)"}`,
                        fontWeight: checked ? 700 : 500,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {b.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--admin-text, #14161A)", display: "block", marginBottom: "4px" }}>Observaciones internas</label>
              <textarea rows={3} value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))} style={bentoInput} />
            </div>
          </div>
        </SectionCard>
      )}

      {tab === "contacts" && (
        <SectionCard eyebrow="CONTACTOS COMERCIALES" title="Agenda de ejecutivos y cuentas">
          <form onSubmit={handleAddContact} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "18px" }}>
            <input required placeholder="Nombre completo *" value={contactForm.full_name} onChange={e => setContactForm(c => ({ ...c, full_name: e.target.value }))} style={bentoInput} />
            <input placeholder="Cargo" value={contactForm.role_title} onChange={e => setContactForm(c => ({ ...c, role_title: e.target.value }))} style={bentoInput} />
            <input type="email" placeholder="Email" value={contactForm.email} onChange={e => setContactForm(c => ({ ...c, email: e.target.value }))} style={bentoInput} />
            <input placeholder="Teléfono" value={contactForm.phone} onChange={e => setContactForm(c => ({ ...c, phone: e.target.value }))} style={bentoInput} />
            <PrimaryButton type="submit" loading={savingContact}><UserPlus size={14} /> Agregar</PrimaryButton>
          </form>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(supplier.contacts || []).map(c => (
              <div key={c.id} style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--admin-surface-secondary, #F8FAFC)", border: "1px solid var(--admin-border, #E2E8F0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontWeight: 700, color: "var(--admin-text, #14161A)", fontSize: "14px" }}>{c.full_name} {c.role_title ? `· ${c.role_title}` : ""}</p>
                  <p style={{ fontSize: "12.5px", color: "var(--admin-text-muted, #475569)", marginTop: "2px" }}>{c.email || "—"} · {c.phone || "—"}</p>
                </div>
                <button type="button" onClick={() => handleDeleteContact(c.id)} style={{ background: "rgba(220,38,38,0.1)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === "products" && (
        <SectionCard eyebrow="CATÁLOGO VINCULADO" title="Productos y variantes suministradas">
          {linkedProducts.length === 0 ? (
            <p style={{ color: "var(--admin-text-muted, #475569)", fontSize: "13px" }}>Aún no hay SKUs vinculados a este proveedor.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="au-table">
                <thead>
                  <tr>
                    <th>SKU Interno</th>
                    <th>Producto / Variante</th>
                    <th>SKU Prov.</th>
                    <th>Costo</th>
                    <th>MOQ / Plazo</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedProducts.map(lp => (
                    <tr key={lp.id}>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-primary-text, #0F9940)", fontWeight: 700 }}>{lp.internal_sku}</td>
                      <td>
                        <span style={{ color: "var(--admin-text, #14161A)", fontWeight: 700 }}>
                          {lp.product_name}{lp.variant_name ? ` — ${lp.variant_name}` : ""}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text, #14161A)" }}>{lp.supplier_sku || "—"}</td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text, #14161A)", fontWeight: 700 }}>
                        {lp.unit_cost != null ? `${formatCurrency(lp.unit_cost, lp.currency)} (${lp.currency} · ${lp.tax_basis === "net" ? "Neto" : "Imp. incl."})` : "Restringido"}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--admin-text, #14161A)" }}>{lp.moq} u. · {lp.lead_time_days}d</td>
                      <td>
                        <StatusBadge tone={lp.is_cost_expired ? "warning" : "success"}>{lp.is_cost_expired ? "Vencida" : "Vigente"}</StatusBadge>
                      </td>
                      <td>
                        {lp.is_preferred && <StatusBadge tone="success">Preferente</StatusBadge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {tab === "history" && (
        <SectionCard eyebrow="TRAZABILIDAD INMUTABLE" title="Historial de modificaciones de costos">
          {historyRows.length === 0 ? (
            <p style={{ color: "var(--admin-text-muted, #475569)", fontSize: "13px" }}>Sin registros históricos de costos.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {historyRows.map(h => (
                <div key={h.id} style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--admin-surface-secondary, #F8FAFC)", border: "1px solid var(--admin-border, #E2E8F0)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontWeight: 700, color: "var(--admin-text, #14161A)", fontSize: "13.5px" }}>{h.product_name}{h.variant_name ? ` — ${h.variant_name}` : ""}</p>
                    <p style={{ fontSize: "12px", color: "var(--admin-text-muted, #475569)", marginTop: "2px" }}>Origen: {h.source} · {h.changed_by_email || "Sistema"} · {new Date(h.recorded_at).toLocaleString("es-CL")}</p>
                  </div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "13.5px", color: "var(--admin-primary-text, #0F9940)", fontWeight: 700 }}>
                    {h.previous_cost != null ? `${formatCurrency(h.previous_cost, h.previous_currency || h.new_currency)} → ` : ""}
                    {h.new_cost != null ? `${formatCurrency(h.new_cost, h.new_currency)} ${h.new_currency}` : "Restringido"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
