// pages/admin/AdminProductDetail.jsx — Editor PIM Avanzado (BF-14 & BF-44) LevelPro Precision
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
import {
  AdminPageHeader,
  SectionCard,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  ConfirmationModal,
  FormField,
  formInputStyle,
  AdminLayoutGrid,
  SwitchToggle,
  UnsavedChangesBar,
  SkeletonCard,
  ErrorState,
} from "../../components/admin/ui"
import ProductSuppliersTab from "../../components/admin/ProductSuppliersTab"
import { showToast } from "../../utils/toast"
import { formatCurrency } from "../../utils/accountingCurrency"
import { Plus, Trash2, Save, SlidersHorizontal, Layers, Package, Truck } from "lucide-react"

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

  const buildInitialForm = (p) => (p ? {
    name: p.name || "",
    sku: p.sku || "",
    price: p.price ?? "",
    compare_price: p.compare_price ?? "",
    price_usd: p.price_usd ?? "",
    price_ars: p.price_ars ?? "",
    stock: p.stock ?? 0,
    stock_min: p.stock_min ?? 3,
    category: p.category?.id || "",
    brand: p.brand?.id || "",
    is_active: p.is_active ?? true,
    short_description: p.short_description || "",
    seo_title: p.seo_title || "",
    seo_description: p.seo_description || "",
  } : null)

  // General form
  const [form, setForm] = useState(null)
  const [savingGeneral, setSavingGeneral] = useState(false)

  useEffect(() => {
    if (!product) return
    setForm(buildInitialForm(product))
  }, [product])

  const initialForm = buildInitialForm(product)
  const isDirtyGeneral = Boolean(
    form && initialForm && (
      form.name !== initialForm.name
      || form.sku !== initialForm.sku
      || String(form.price) !== String(initialForm.price)
      || String(form.compare_price) !== String(initialForm.compare_price)
      || String(form.price_usd) !== String(initialForm.price_usd)
      || String(form.price_ars) !== String(initialForm.price_ars)
      || String(form.stock) !== String(initialForm.stock)
      || String(form.category) !== String(initialForm.category)
      || String(form.brand) !== String(initialForm.brand)
      || Boolean(form.is_active) !== Boolean(initialForm.is_active)
      || form.short_description !== initialForm.short_description
    )
  )

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
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState(null)

  // Specs state: { [key]: value }
  const [specValues, setSpecValues] = useState({})
  const [showAllSpecs, setShowAllSpecs] = useState(false)
  const [savingSpecs, setSavingSpecs] = useState(false)

  useEffect(() => {
    const map = {}
    ;(productSpecsData?.specs || []).forEach((s) => {
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

  const executeDeleteVariant = async () => {
    if (!confirmDeleteVariant) return
    try {
      await deleteAdminProductVariant(id, confirmDeleteVariant.id)
      refetchVariants()
      refetch()
      showToast("Variante desactivada")
    } catch {
      showToast("No se pudo desactivar la variante", "error")
    } finally {
      setConfirmDeleteVariant(null)
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

  if (isLoading) {
    return (
      <div className="au-page">
        <AdminPageHeader title="Ficha de producto" description="Cargando detalles del catálogo…" />
        <SkeletonCard height={260} />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="au-page">
        <ErrorState
          title="No se encontró el producto"
          description="Verifica el identificador o vuelve al catálogo."
          action={<SecondaryButton onClick={() => navigate("/admin/products")}>← Volver a Productos</SecondaryButton>}
        />
      </div>
    )
  }

  const visibleAttrs = showAllSpecs || recommendedKeys.length === 0
    ? allAttrs
    : allAttrs.filter((a) => recommendedKeys.includes(a.key) || specValues[a.key])

  const TABS = [
    { key: "variants", label: `Variantes (${variants.length})`, Icon: Layers },
    { key: "specs", label: `Especificaciones Técnicas (${product.technical_specs?.length || 0})`, Icon: SlidersHorizontal },
    { key: "suppliers", label: "Proveedores", Icon: Truck },
    { key: "general", label: "General & Precios", Icon: Package },
  ]

  return (
    <div className="au-page">
      <ConfirmationModal
        open={!!confirmDeleteVariant}
        title="¿Desactivar variante comercial?"
        description={confirmDeleteVariant ? `Vas a desactivar "${confirmDeleteVariant.name}" (${confirmDeleteVariant.sku}) del catálogo público.` : ""}
        warningNote="Se conservarán íntegramente sus órdenes históricas, números de serie y reservas de Kardex."
        confirmLabel="Sí, desactivar variante"
        danger
        onConfirm={executeDeleteVariant}
        onCancel={() => setConfirmDeleteVariant(null)}
        testId="deactivate-variant-modal"
      />

      <AdminPageHeader
        title={product.name}
        description={`SKU Maestro: ${product.sku || "Sin SKU"} · ${variants.length} variantes · ${product.technical_specs?.length || 0} especificaciones`}
        breadcrumbs={[
          { label: "Productos", to: "/admin/products" },
          { label: product.name },
        ]}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge tone={product.is_active ? "success" : "neutral"}>
              {product.is_active ? "Activo" : "Inactivo"}
            </StatusBadge>
            <SecondaryButton to="/admin/products" size="sm">← Volver al catálogo</SecondaryButton>
          </div>
        }
      />

      {/* Underline Nimbus Tabs */}
      <div className="au-tabs hide-scroll" role="tablist" aria-label="Secciones de producto">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = tab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`pim-tab-${key}`}
              onClick={() => setTab(key)}
              className={`au-tab${isActive ? " is-active" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB VARIANTES (BF-14) */}
      {tab === "variants" && (
        <AdminLayoutGrid layout="asym">
          <SectionCard
            title="Variantes registradas"
            description="Cada variante mantiene su SKU, precio multimoneda o herencia del maestro y stock"
            padding={false}
          >
            {variants.length === 0 ? (
              <p style={{ fontSize: 13, color: "#71717A", padding: 20 }}>
                Este producto opera como producto simple sin variantes. Puedes agregar variantes cuando existan opciones de impedancia, color o conexión.
              </p>
            ) : (
              <div className="au-tscroll">
                <table className="au-table">
                  <thead>
                    <tr>
                      <th>Variante</th>
                      <th>SKU</th>
                      <th style={{ textAlign: "right" }}>Precio</th>
                      <th style={{ textAlign: "right" }}>Stock</th>
                      <th style={{ textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.id} data-testid={`variant-row-${v.sku}`}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, color: "#09090B" }}>{v.name}</span>
                            {v.is_default && <StatusBadge tone="success">Default</StatusBadge>}
                            {!v.is_active && <StatusBadge tone="danger">Inactiva</StatusBadge>}
                          </div>
                        </td>
                        <td className="lp-mono" style={{ color: "#52525B" }}>{v.sku}</td>
                        <td className="lp-mono" style={{ textAlign: "right", color: "#09090B", fontWeight: 500 }}>
                          {formatCurrency(v.prices?.CLP ?? v.effective_price, "CLP")}
                          {(v.prices?.USD ?? v.price_usd) && (
                            <span style={{ display: "block", fontSize: 11, color: "#71717A" }}>
                              {formatCurrency(v.prices?.USD ?? v.price_usd, "USD")} USD
                            </span>
                          )}
                        </td>
                        <td className="lp-mono" style={{ textAlign: "right", fontWeight: 600, color: "#09090B" }}>
                          {v.stock}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <SecondaryButton size="sm" onClick={() => handleEditVariant(v)}>Editar</SecondaryButton>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteVariant(v)}
                              aria-label="Eliminar variante"
                              className="au-iconbtn"
                              style={{ color: "#DC2626", borderColor: "#FECACA", background: "#FEF2F2" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={editingVariantId ? "Editar variante" : "Nueva variante"}
            description="Captura de SKU y atributos técnicos"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FormField label="SKU Único" required>
                <input data-testid="variant-sku-input" value={variantForm.sku} onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Ej: DT770-250-BLK" style={formInputStyle} />
              </FormField>
              <FormField label="Código de barras">
                <input value={variantForm.barcode} onChange={(e) => setVariantForm((f) => ({ ...f, barcode: e.target.value }))} placeholder="EAN / UPC" style={formInputStyle} />
              </FormField>
              <div style={{ gridColumn: "1 / -1" }}>
                <FormField label="Nombre comercial" required>
                  <input data-testid="variant-name-input" value={variantForm.name} onChange={(e) => setVariantForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: 250 Ohm / Negro Mate" style={formInputStyle} />
                </FormField>
              </div>
              <FormField label="Impedancia">
                <input value={variantForm.impedance} onChange={(e) => setVariantForm((f) => ({ ...f, impedance: e.target.value }))} placeholder="Ej: 250 Ohm" style={formInputStyle} />
              </FormField>
              <FormField label="Color">
                <input value={variantForm.color} onChange={(e) => setVariantForm((f) => ({ ...f, color: e.target.value }))} placeholder="Ej: Negro" style={formInputStyle} />
              </FormField>
              <FormField label="Conexión">
                <input value={variantForm.connection} onChange={(e) => setVariantForm((f) => ({ ...f, connection: e.target.value }))} placeholder="Ej: XLR / Jack 6.3mm" style={formInputStyle} />
              </FormField>
              <FormField label="Tamaño / Config.">
                <input value={variantForm.size} onChange={(e) => setVariantForm((f) => ({ ...f, size: e.target.value }))} placeholder="Ej: Studio Pack" style={formInputStyle} />
              </FormField>
              <FormField label="Precio CLP">
                <input data-testid="variant-price-input" type="number" value={variantForm.price} onChange={(e) => setVariantForm((f) => ({ ...f, price: e.target.value }))} placeholder={String(product.price)} style={formInputStyle} />
              </FormField>
              <FormField label="Precio USD (opc.)">
                <input data-testid="variant-price-usd-input" type="number" step="0.01" value={variantForm.price_usd} onChange={(e) => setVariantForm((f) => ({ ...f, price_usd: e.target.value }))} placeholder={product.price_usd != null ? String(product.price_usd) : ""} style={formInputStyle} />
              </FormField>
              <FormField label="Precio ARS (opc.)">
                <input data-testid="variant-price-ars-input" type="number" step="1" value={variantForm.price_ars} onChange={(e) => setVariantForm((f) => ({ ...f, price_ars: e.target.value }))} placeholder={product.price_ars != null ? String(product.price_ars) : ""} style={formInputStyle} />
              </FormField>
              <FormField label="Stock" required>
                <input data-testid="variant-stock-input" type="number" min="0" value={variantForm.stock} onChange={(e) => setVariantForm((f) => ({ ...f, stock: e.target.value }))} style={formInputStyle} />
              </FormField>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, color: "#09090B" }}>
              <label style={{ fontSize: 12.5, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={variantForm.is_active} onChange={(e) => setVariantForm((f) => ({ ...f, is_active: e.target.checked }))} /> Activa
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={variantForm.is_default} onChange={(e) => setVariantForm((f) => ({ ...f, is_default: e.target.checked }))} /> Default
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <PrimaryButton data-testid="save-variant-btn" icon={Plus} onClick={handleSaveVariant} loading={savingVariant}>
                {editingVariantId ? "Guardar variante" : "Agregar variante"}
              </PrimaryButton>
              {editingVariantId && (
                <SecondaryButton onClick={() => { setEditingVariantId(null); setVariantForm(emptyVariantForm) }}>
                  Cancelar
                </SecondaryButton>
              )}
            </div>
          </SectionCard>
        </AdminLayoutGrid>
      )}

      {/* TAB ESPECIFICACIONES TÉCNICAS (BF-44) */}
      {tab === "specs" && (
        <SectionCard
          title="Especificaciones técnicas estructuradas"
          description="Atributos validados según familia de producto para ficha pública y comparador."
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SecondaryButton size="sm" onClick={() => setShowAllSpecs((s) => !s)}>
                {showAllSpecs ? "Solo recomendados de categoría" : `Ver todos (${allAttrs.length})`}
              </SecondaryButton>
              <PrimaryButton size="sm" icon={Save} data-testid="save-specs-btn" onClick={handleSaveSpecs} loading={savingSpecs}>
                Guardar especificaciones
              </PrimaryButton>
            </div>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            {visibleAttrs.map((attr) => (
              <div key={attr.key} style={{ padding: 12, borderRadius: 8, background: "#FAFAFA", border: "1px solid #E4E4E7" }}>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#09090B", marginBottom: 6 }}>
                  <span>{attr.label}</span>
                  {attr.unit && <span className="lp-mono" style={{ color: "#0F7A38", fontSize: 11 }}>{attr.unit}</span>}
                </label>

                {attr.data_type === "boolean" ? (
                  <select
                    value={specValues[attr.key] || ""}
                    onChange={(e) => setSpecValues((p) => ({ ...p, [attr.key]: e.target.value }))}
                    style={formInputStyle}
                  >
                    <option value="">No especificado</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : attr.data_type === "select" && attr.options?.length > 0 ? (
                  <select
                    value={specValues[attr.key] || ""}
                    onChange={(e) => setSpecValues((p) => ({ ...p, [attr.key]: e.target.value }))}
                    style={formInputStyle}
                  >
                    <option value="">No especificado</option>
                    {attr.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    data-testid={`spec-input-${attr.key}`}
                    type={attr.data_type === "number" || attr.data_type === "decimal" ? "number" : "text"}
                    step={attr.data_type === "decimal" ? "0.01" : "1"}
                    value={specValues[attr.key] || ""}
                    onChange={(e) => setSpecValues((p) => ({ ...p, [attr.key]: e.target.value }))}
                    placeholder={attr.options?.length ? attr.options.slice(0, 2).join(", ") : `Ingresa ${attr.label.toLowerCase()}`}
                    style={formInputStyle}
                  />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* TAB PROVEEDORES (GATE 3: BF-02) */}
      {tab === "suppliers" && (
        <ProductSuppliersTab product={product} variants={variants} />
      )}

      {/* TAB GENERAL — Layout Asimétrico 2/3 + 1/3 Nimbus */}
      {tab === "general" && form && (
        <AdminLayoutGrid layout="asym">
          <div className="au-stack">
            <SectionCard title="Nombre y descripción">
              <div className="au-stack-sm">
                <FormField label="Nombre del producto" required description="Nombre visible en el catálogo público.">
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={formInputStyle} />
                </FormField>
                <FormField label="Descripción corta">
                  <textarea
                    rows={3}
                    value={form.short_description}
                    onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                    style={{ ...formInputStyle, resize: "vertical" }}
                  />
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Precios por moneda (sin conversión implícita)">
              <div className="au-grid-2">
                <FormField label="Precio CLP" required>
                  <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} style={formInputStyle} />
                </FormField>
                <FormField label="Precio comparativo CLP">
                  <input type="number" value={form.compare_price} onChange={(e) => setForm((f) => ({ ...f, compare_price: e.target.value }))} style={formInputStyle} />
                </FormField>
                <FormField label="Precio USD (opcional)">
                  <input type="number" step="0.01" value={form.price_usd} onChange={(e) => setForm((f) => ({ ...f, price_usd: e.target.value }))} style={formInputStyle} />
                </FormField>
                <FormField label="Precio ARS (opcional)">
                  <input type="number" value={form.price_ars} onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))} style={formInputStyle} />
                </FormField>
              </div>
            </SectionCard>
          </div>

          <div className="au-stack">
            <SectionCard title="Publicación">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#09090B", margin: 0 }}>Visible en tienda</p>
                  <p style={{ fontSize: 12, color: "#71717A", margin: "2px 0 0" }}>Publicar en catálogo activo</p>
                </div>
                <SwitchToggle
                  checked={form.is_active}
                  onChange={(val) => setForm((f) => ({ ...f, is_active: val }))}
                  label="Visible en tienda"
                />
              </div>
            </SectionCard>

            <SectionCard title="Organización">
              <div className="au-stack-sm">
                <FormField label="Categoría">
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={formInputStyle}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Marca">
                  <select value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} style={formInputStyle}>
                    <option value="">Sin marca</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Inventario base">
              <div className="au-stack-sm">
                <FormField label="SKU Maestro">
                  <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="lp-mono" style={formInputStyle} />
                </FormField>
                <FormField label="Stock base">
                  <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))} style={formInputStyle} />
                </FormField>
                <PrimaryButton icon={Save} onClick={handleSaveGeneral} loading={savingGeneral} style={{ width: "100%", marginTop: 4 }}>
                  Guardar cambios
                </PrimaryButton>
              </div>
            </SectionCard>
          </div>
        </AdminLayoutGrid>
      )}

      <UnsavedChangesBar
        dirty={tab === "general" && isDirtyGeneral}
        saving={savingGeneral}
        onSave={handleSaveGeneral}
        onDiscard={() => product && setForm(buildInitialForm(product))}
      />
    </div>
  )
}
