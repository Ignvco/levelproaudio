// pages/admin/AdminProductDetail.jsx — Editor PIM Avanzado (BF-14 & BF-44)
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAdminProduct,
  getAdminCategories,
  getAdminBrands,
  updateAdminProduct,
  getAdminProductVariants,
  createAdminProductVariant,
  updateAdminProductVariant,
  deleteAdminProductVariant,
  getTechnicalAttributesCatalog,
  getAdminProductSpecs,
  saveAdminProductSpecs,
} from "../../api/admin.api"
import { AdminPageHeader, SectionCard, PrimaryButton, SecondaryButton, StatusBadge } from "../../components/admin/ui"
import { showToast } from "../../utils/toast"
import { formatCurrency } from "../../utils/accountingCurrency"
import { Plus, Trash2, Save, SlidersHorizontal, Layers, Package } from "lucide-react"

const bentoInput = {
  width: "100%",
  padding: "10px 12px",
  background: "#0B0E14",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "#F8FAFC",
  fontSize: "13px",
  outline: "none",
}

export default function AdminProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState("variants")

  const { data: product, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-product-detail", id],
    queryFn: () => getAdminProduct(id),
    enabled: !!id,
  })
  const { data: categoriesData } = useQuery({ queryKey: ["admin-categories"], queryFn: () => getAdminCategories() })
  const { data: brandsData } = useQuery({ queryKey: ["admin-brands"], queryFn: () => getAdminBrands() })
  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ["admin-product-variants", id],
    queryFn: () => getAdminProductVariants(id),
    enabled: !!id,
  })
  const { data: attrCatalog } = useQuery({
    queryKey: ["admin-tech-attrs", product?.category?.id],
    queryFn: () => getTechnicalAttributesCatalog(product?.category?.id),
    enabled: !!product,
  })
  const { data: productSpecsData, refetch: refetchSpecs } = useQuery({
    queryKey: ["admin-product-specs", id],
    queryFn: () => getAdminProductSpecs(id),
    enabled: !!id,
  })

  const categories = Array.isArray(categoriesData) ? categoriesData : categoriesData?.results || []
  const brands = Array.isArray(brandsData) ? brandsData : brandsData?.results || []
  const variants = variantsData?.results || []
  const allAttrs = attrCatalog?.attributes || []
  const recommendedKeys = attrCatalog?.recommended_keys || []

  // General form
  const [form, setForm] = useState(null)
  const [savingGeneral, setSavingGeneral] = useState(false)

  useEffect(() => {
    if (!product) return
    setForm({
      name: product.name || "",
      sku: product.sku || "",
      price: product.price ?? "",
      compare_price: product.compare_price ?? "",
      price_usd: product.price_usd ?? "",
      price_ars: product.price_ars ?? "",
      stock: product.stock ?? 0,
      stock_min: product.stock_min ?? 3,
      category: product.category?.id || "",
      brand: product.brand?.id || "",
      is_active: product.is_active ?? true,
      short_description: product.short_description || "",
      seo_title: product.seo_title || "",
      seo_description: product.seo_description || "",
    })
  }, [product])

  // Variant form
  const emptyVariantForm = {
    sku: "",
    barcode: "",
    name: "",
    impedance: "",
    color: "",
    connection: "",
    size: "",
    configuration: "",
    price: "",
    price_usd: "",
    price_ars: "",
    stock: "0",
    stock_min: "3",
    is_active: true,
    is_default: false,
  }
  const [variantForm, setVariantForm] = useState(emptyVariantForm)
  const [editingVariantId, setEditingVariantId] = useState(null)
  const [savingVariant, setSavingVariant] = useState(false)

  // Specs state: { [key]: value }
  const [specValues, setSpecValues] = useState({})
  const [showAllSpecs, setShowAllSpecs] = useState(false)
  const [savingSpecs, setSavingSpecs] = useState(false)

  useEffect(() => {
    const map = {}
    ;(productSpecsData?.specs || []).forEach(s => {
      if (s.data_type === "boolean") {
        map[s.key] = s.value_json === true ? "true" : s.value_json === false ? "false" : ""
      } else {
        map[s.key] = s.value_text || ""
      }
    })
    setSpecValues(map)
  }, [productSpecsData])

  const handleSaveGeneral = async () => {
    if (!form) return
    setSavingGeneral(true)
    try {
      await updateAdminProduct(id, {
        ...form,
        compare_price: form.compare_price || null,
        price_usd: form.price_usd || null,
        price_ars: form.price_ars || null,
        category: form.category || null,
        brand: form.brand || null,
      })
      queryClient.invalidateQueries({ queryKey: ["admin-products"] })
      refetch()
      showToast("Producto actualizado correctamente")
    } catch (e) {
      showToast(e?.response?.data?.error || "Error al guardar cambios", "error")
    } finally {
      setSavingGeneral(false)
    }
  }

  const handleEditVariant = (v) => {
    setEditingVariantId(v.id)
    setVariantForm({
      sku: v.sku || "",
      barcode: v.barcode || "",
      name: v.name || "",
      impedance: v.attributes?.impedance || "",
      color: v.attributes?.color || "",
      connection: v.attributes?.connection || "",
      size: v.attributes?.size || "",
      configuration: v.attributes?.configuration || "",
      price: v.price ?? "",
      price_usd: v.price_usd ?? "",
      price_ars: v.price_ars ?? "",
      stock: String(v.stock ?? 0),
      stock_min: String(v.stock_min ?? 3),
      is_active: v.is_active ?? true,
      is_default: v.is_default ?? false,
    })
  }

  const handleSaveVariant = async () => {
    if (!variantForm.sku.trim() || !variantForm.name.trim()) {
      showToast("SKU y nombre de variante son obligatorios", "error")
      return
    }
    setSavingVariant(true)
    try {
      const attributes = {}
      if (variantForm.impedance.trim()) attributes.impedance = variantForm.impedance.trim()
      if (variantForm.color.trim()) attributes.color = variantForm.color.trim()
      if (variantForm.connection.trim()) attributes.connection = variantForm.connection.trim()
      if (variantForm.size.trim()) attributes.size = variantForm.size.trim()
      if (variantForm.configuration.trim()) attributes.configuration = variantForm.configuration.trim()

      const payload = {
        sku: variantForm.sku.trim(),
        barcode: variantForm.barcode.trim(),
        name: variantForm.name.trim(),
        attributes,
        price: variantForm.price !== "" ? variantForm.price : null,
        price_usd: variantForm.price_usd !== "" ? variantForm.price_usd : null,
        price_ars: variantForm.price_ars !== "" ? variantForm.price_ars : null,
        stock: Number(variantForm.stock) || 0,
        stock_min: Number(variantForm.stock_min) || 3,
        is_active: variantForm.is_active,
        is_default: variantForm.is_default,
      }

      if (editingVariantId) {
        await updateAdminProductVariant(id, editingVariantId, payload)
        showToast("Variante actualizada")
      } else {
        await createAdminProductVariant(id, payload)
        showToast("Variante creada")
      }
      setVariantForm(emptyVariantForm)
      setEditingVariantId(null)
      refetchVariants()
      refetch()
    } catch (e) {
      const err = e?.response?.data?.error
      showToast(typeof err === "string" ? err : JSON.stringify(err || "Error al guardar variante"), "error")
    } finally {
      setSavingVariant(false)
    }
  }

  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm("¿Desactivar esta variante? Se conservarán sus referencias históricas y reservas.")) return
    try {
      await deleteAdminProductVariant(id, variantId)
      refetchVariants()
      refetch()
      showToast("Variante desactivada")
    } catch {
      showToast("No se pudo desactivar la variante", "error")
    }
  }

  const handleSaveSpecs = async () => {
    setSavingSpecs(true)
    try {
      const specsPayload = Object.entries(specValues).map(([key, value]) => ({
        key,
        value,
      }))
      await saveAdminProductSpecs(id, specsPayload)
      refetchSpecs()
      refetch()
      showToast("Especificaciones técnicas guardadas")
    } catch (e) {
      showToast(e?.response?.data?.error || "Error al guardar especificaciones", "error")
    } finally {
      setSavingSpecs(false)
    }
  }

  if (isLoading) return <div className="au-page"><p style={{ color: "var(--admin-text-muted)" }}>Cargando ficha PIM…</p></div>
  if (isError || !product) return (
    <div className="au-page">
      <p style={{ color: "var(--admin-danger)" }}>No se encontró el producto.</p>
      <SecondaryButton onClick={() => navigate("/admin/products")}>← Volver a Productos</SecondaryButton>
    </div>
  )

  const visibleAttrs = showAllSpecs || recommendedKeys.length === 0
    ? allAttrs
    : allAttrs.filter(a => recommendedKeys.includes(a.key) || specValues[a.key])

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO PIM / FICHA TÉCNICA & VARIANTES"
        title={product.name}
        description={`SKU Maestro: ${product.sku || "Sin SKU"} · ${variants.length} variantes · ${product.technical_specs?.length || 0} especificaciones`}
        breadcrumbs={[
          { label: "Productos", to: "/admin/products" },
          { label: product.name },
        ]}
        actions={
          <SecondaryButton to="/admin/products" size="sm">← Volver al catálogo</SecondaryButton>
        }
      />

      {/* Tabs Editorial Bento */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {[
          { key: "variants", label: `Variantes (${variants.length})`, Icon: Layers },
          { key: "specs", label: `Especificaciones Técnicas (${product.technical_specs?.length || 0})`, Icon: SlidersHorizontal },
          { key: "general", label: "General & Precios", Icon: Package },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            data-testid={`pim-tab-${key}`}
            onClick={() => setTab(key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 16px", borderRadius: "12px", cursor: "pointer",
              fontSize: "13px", fontWeight: 700,
              background: tab === key ? "#1AFF6E" : "#121722",
              color: tab === key ? "#0B0E14" : "#CBD5E1",
              border: tab === key ? "none" : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* TAB VARIANTES (BF-14) */}
      {tab === "variants" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "18px", alignItems: "start" }}>
          <SectionCard
            eyebrow="VARIANTES COMERCIALES"
            title={editingVariantId ? "Editar variante" : "Nueva variante"}
            description="Cada variante administra su propio SKU único, precio (o herencia) y existencias."
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>SKU Único *</label>
                <input data-testid="variant-sku-input" value={variantForm.sku} onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))} placeholder="Ej: DT770-250-BLK" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Código de barras</label>
                <input value={variantForm.barcode} onChange={e => setVariantForm(f => ({ ...f, barcode: e.target.value }))} placeholder="EAN / UPC" style={bentoInput} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Nombre comercial *</label>
                <input data-testid="variant-name-input" value={variantForm.name} onChange={e => setVariantForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: 250 Ohm / Negro Mate" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Impedancia</label>
                <input value={variantForm.impedance} onChange={e => setVariantForm(f => ({ ...f, impedance: e.target.value }))} placeholder="Ej: 250 Ohm" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Color</label>
                <input value={variantForm.color} onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))} placeholder="Ej: Negro" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Conexión</label>
                <input value={variantForm.connection} onChange={e => setVariantForm(f => ({ ...f, connection: e.target.value }))} placeholder="Ej: XLR / Jack 6.3mm" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Tamaño / Configuración</label>
                <input value={variantForm.size} onChange={e => setVariantForm(f => ({ ...f, size: e.target.value }))} placeholder="Ej: 3m / Studio Pack" style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Precio CLP (vacío = hereda)</label>
                <input data-testid="variant-price-input" type="number" value={variantForm.price} onChange={e => setVariantForm(f => ({ ...f, price: e.target.value }))} placeholder={String(product.price)} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Precio USD (opcional)</label>
                <input data-testid="variant-price-usd-input" type="number" step="0.01" value={variantForm.price_usd} onChange={e => setVariantForm(f => ({ ...f, price_usd: e.target.value }))} placeholder={product.price_usd != null ? String(product.price_usd) : ""} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Precio ARS (opcional)</label>
                <input data-testid="variant-price-ars-input" type="number" step="1" value={variantForm.price_ars} onChange={e => setVariantForm(f => ({ ...f, price_ars: e.target.value }))} placeholder={product.price_ars != null ? String(product.price_ars) : ""} style={bentoInput} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Stock *</label>
                <input data-testid="variant-stock-input" type="number" min="0" value={variantForm.stock} onChange={e => setVariantForm(f => ({ ...f, stock: e.target.value }))} style={bentoInput} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "18px", color: "var(--admin-text)" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input type="checkbox" checked={variantForm.is_active} onChange={e => setVariantForm(f => ({ ...f, is_active: e.target.checked }))} /> Activa
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input type="checkbox" checked={variantForm.is_default} onChange={e => setVariantForm(f => ({ ...f, is_default: e.target.checked }))} /> Default
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <PrimaryButton data-testid="save-variant-btn" onClick={handleSaveVariant} loading={savingVariant}>
                <Plus size={14} /> {editingVariantId ? "Guardar variante" : "Agregar variante"}
              </PrimaryButton>
              {editingVariantId && (
                <SecondaryButton onClick={() => { setEditingVariantId(null); setVariantForm(emptyVariantForm) }}>
                  Cancelar
                </SecondaryButton>
              )}
            </div>
          </SectionCard>

          <SectionCard eyebrow="LISTADO" title="Variantes registradas">
            {variants.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#94A3B8" }}>
                Este producto opera como producto simple sin variantes. Puedes agregar variantes cuando existan opciones de impedancia, color o conexión.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {variants.map(v => (
                  <div key={v.id} data-testid={`variant-row-${v.sku}`} style={{
                    padding: "12px 14px", borderRadius: "12px",
                    background: "#0B0E14", border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                  }}>
                    <div>
                      <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#F8FAFC", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {v.name}
                        {v.is_default && <StatusBadge tone="success">Default</StatusBadge>}
                        {!v.is_active && <StatusBadge tone="danger">Inactiva</StatusBadge>}
                      </p>
                      <p style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", color: "#94A3B8", marginTop: "3px" }}>
                        SKU: {v.sku} · {formatCurrency(v.prices?.CLP ?? v.effective_price, "CLP")} · {formatCurrency(v.prices?.USD ?? v.price_usd, "USD")} · {formatCurrency(v.prices?.ARS ?? v.price_ars, "ARS")} · Stock: {v.stock}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <SecondaryButton size="sm" onClick={() => handleEditVariant(v)}>Editar</SecondaryButton>
                      <button type="button" onClick={() => handleDeleteVariant(v.id)} aria-label="Eliminar variante"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#F87171", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB ESPECIFICACIONES TÉCNICAS (BF-44) */}
      {tab === "specs" && (
        <SectionCard
          eyebrow="CATÁLOGO TÉCNICO AUDIO PRO"
          title="Especificaciones técnicas estructuradas"
          description="Atributos validados según familia de producto para ficha pública y comparador."
          actions={
            <div style={{ display: "flex", gap: "8px" }}>
              <SecondaryButton size="sm" onClick={() => setShowAllSpecs(s => !s)}>
                {showAllSpecs ? "Solo recomendados de categoría" : `Ver todos (${allAttrs.length})`}
              </SecondaryButton>
              <PrimaryButton data-testid="save-specs-btn" onClick={handleSaveSpecs} loading={savingSpecs}>
                <Save size={14} /> Guardar especificaciones
              </PrimaryButton>
            </div>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
            {visibleAttrs.map(attr => (
              <div key={attr.key} style={{ padding: "12px", borderRadius: "12px", background: "#0B0E14", border: "1px solid rgba(255,255,255,0.08)" }}>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "#E2E8F0", marginBottom: "6px" }}>
                  <span>{attr.label}</span>
                  {attr.unit && <span style={{ color: "#1AFF6E", fontFamily: "var(--font-mono)", fontSize: "11px" }}>{attr.unit}</span>}
                </label>

                {attr.data_type === "boolean" ? (
                  <select
                    value={specValues[attr.key] || ""}
                    onChange={e => setSpecValues(p => ({ ...p, [attr.key]: e.target.value }))}
                    style={bentoInput}
                  >
                    <option value="">No especificado</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : attr.data_type === "select" && attr.options?.length > 0 ? (
                  <select
                    value={specValues[attr.key] || ""}
                    onChange={e => setSpecValues(p => ({ ...p, [attr.key]: e.target.value }))}
                    style={bentoInput}
                  >
                    <option value="">No especificado</option>
                    {attr.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    data-testid={`spec-input-${attr.key}`}
                    type={attr.data_type === "number" || attr.data_type === "decimal" ? "number" : "text"}
                    step={attr.data_type === "decimal" ? "0.01" : "1"}
                    value={specValues[attr.key] || ""}
                    onChange={e => setSpecValues(p => ({ ...p, [attr.key]: e.target.value }))}
                    placeholder={attr.options?.length ? attr.options.slice(0, 2).join(", ") : `Ingresa ${attr.label.toLowerCase()}`}
                    style={bentoInput}
                  />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* TAB GENERAL */}
      {tab === "general" && form && (
        <SectionCard
          eyebrow="DATOS COMERCIALES"
          title="Información del producto maestro"
          actions={
            <PrimaryButton onClick={handleSaveGeneral} loading={savingGeneral}>
              <Save size={14} /> Guardar cambios
            </PrimaryButton>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>Nombre</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>SKU Maestro</label>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>Precio CLP</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>Precio USD</label>
              <input type="number" step="0.01" value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>Precio ARS</label>
              <input type="number" value={form.price_ars} onChange={e => setForm(f => ({ ...f, price_ars: e.target.value }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>Stock base</label>
              <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))} style={bentoInput} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>Categoría</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={bentoInput}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94A3B8" }}>Marca</label>
              <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} style={bentoInput}>
                <option value="">Sin marca</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
