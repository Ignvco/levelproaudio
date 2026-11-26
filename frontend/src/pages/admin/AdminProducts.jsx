// pages/admin/AdminProducts.jsx
import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminProducts, getAdminCategories, getAdminBrands,
  createAdminProduct, updateAdminProduct, deleteAdminProduct,
  uploadProductImage, deleteProductImage, setPrimaryImage,
  exportAdminCatalog,
} from "../../api/admin.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../utils/toast"
import { DataTable, StatusBadge, AdminPageHeader, PrimaryButton, SecondaryButton, StatCard, FormModal, ConfirmationModal, FilterChipBar, formInputStyle } from "../../components/admin/ui"
import BulkEditModal from "../../components/admin/BulkEditModal"
import { useSiteSettings } from "../../hooks/useSiteSettings"
import { formatCurrency } from "../../utils/accountingCurrency"
import { Pencil, Trash2, Package, CheckCircle2, Star, AlertTriangle, Layers, Download, SlidersHorizontal, Image, Upload, Loader2, Plus, X } from "lucide-react"

const inputSt = formInputStyle

// ── Formulario de producto ────────────────────────────────────
// ── Picker de "Completá tu setup con" — busca entre TODOS los
// productos (no solo los que coinciden con los filtros de la lista),
// muestra chips de lo ya elegido, y guarda solo IDs para el backend.
function BundleItemsPicker({ productId, items, onChange }) {
  // items: [{ product_id, quantity, name }]
  const [search, setSearch] = useState("")

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["admin-bundle-picker", search],
    queryFn: () => getAdminProducts({ search, page_size: 8 }),
    enabled: search.trim().length >= 2,
  })
  const results = (searchResults?.results || searchResults || [])
    .filter(p => p.id !== productId && p.product_type !== "bundle")  // sin auto-referencia ni kits dentro de kits

  const addItem = (p) => {
    if (items.some(it => it.product_id === p.id)) return
    onChange([...items, { product_id: p.id, quantity: 1, name: p.name }])
  }
  const removeItem = (id) => onChange(items.filter(it => it.product_id !== id))
  const setQty = (id, qty) =>
    onChange(items.map(it => it.product_id === id ? { ...it, quantity: Math.max(1, qty) } : it))

  return (
    <div style={{ marginTop: "20px", padding: "16px", borderRadius: "var(--r-lg)",
      background: "rgba(26,255,110,0.03)", border: "1px solid rgba(26,255,110,0.15)" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600,
        color: "var(--accent)", marginBottom: "3px" }}>
        Componentes del kit
      </label>
      <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "12px" }}>
        Los productos que incluye este kit. El precio del kit es el que pusiste arriba (fijo);
        el stock se calcula de estos componentes.
      </p>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {items.map(it => (
            <div key={it.product_id} style={{ display: "flex", alignItems: "center", gap: "10px",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)", padding: "8px 12px" }}>
              <span style={{ flex: 1, fontSize: "13px" }}>{it.name || it.product_id}</span>
              <input type="number" min="1" value={it.quantity}
                onChange={e => setQty(it.product_id, Number(e.target.value))}
                style={{ width: "60px", padding: "5px 8px", borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)", background: "var(--surface)",
                  color: "var(--text)", fontSize: "13px" }} />
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>unid.</span>
              <button type="button" onClick={() => removeItem(it.product_id)}
                style={{ background: "rgba(255,77,77,0.15)", color: "#ff6b6b", border: "none",
                  borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer",
                  fontSize: "13px", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar producto para agregar al kit…" style={inputSt} />

      {search.trim().length >= 2 && (
        <div style={{ marginTop: "8px", maxHeight: "180px", overflowY: "auto",
          border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
          {isFetching ? (
            <p style={{ padding: "12px", fontSize: "12px", color: "var(--text-3)" }}>Buscando…</p>
          ) : results.length === 0 ? (
            <p style={{ padding: "12px", fontSize: "12px", color: "var(--text-3)" }}>Sin resultados.</p>
          ) : results.map(p => (
            <button key={p.id} type="button" onClick={() => addItem(p)}
              disabled={items.some(it => it.product_id === p.id)}
              style={{ display: "block", width: "100%", textAlign: "left",
                padding: "8px 12px", cursor: "pointer", fontSize: "13px",
                borderBottom: "1px solid var(--border)", background: "transparent",
                border: "none", color: items.some(it => it.product_id === p.id) ? "var(--text-3)" : "var(--text)" }}>
              {p.name} {items.some(it => it.product_id === p.id) && "· agregado"}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RelatedProductsPicker({ productId, initialSelected, selected, onChange }) {
  const [search, setSearch] = useState("")
  const [namesById, setNamesById] = useState(() => {
    const map = {}
    initialSelected.forEach(p => { map[p.id] = p.name })
    return map
  })

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["admin-products-picker", search],
    queryFn: () => getAdminProducts({ search, page_size: 8 }),
    enabled: search.trim().length >= 2,
  })
  const results = (searchResults?.results || searchResults || [])
    .filter(p => p.id !== productId)  // un producto no puede complementarse a sí mismo

  const toggle = (p) => {
    if (selected.includes(p.id)) {
      onChange(selected.filter(id => id !== p.id))
    } else {
      setNamesById(prev => ({ ...prev, [p.id]: p.name }))
      onChange([...selected, p.id])
    }
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600,
        color: "var(--text-2)", marginBottom: "7px" }}>
        Completá tu setup con (accesorios / productos complementarios)
      </label>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {selected.map(id => (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: "6px",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: "9999px", padding: "5px 6px 5px 12px", fontSize: "12px" }}>
              {namesById[id] || id}
              <button type="button" onClick={() => onChange(selected.filter(x => x !== id))}
                style={{ background: "rgba(255,77,77,0.15)", color: "#ff6b6b", border: "none",
                  borderRadius: "50%", width: "16px", height: "16px", cursor: "pointer",
                  fontSize: "11px", lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar producto por nombre (mínimo 2 letras)…" style={inputSt} />

      {search.trim().length >= 2 && (
        <div style={{ marginTop: "8px", maxHeight: "180px", overflowY: "auto",
          border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
          {isFetching ? (
            <p style={{ padding: "12px", fontSize: "12px", color: "var(--text-3)" }}>Buscando…</p>
          ) : results.length === 0 ? (
            <p style={{ padding: "12px", fontSize: "12px", color: "var(--text-3)" }}>Sin resultados.</p>
          ) : results.map(p => (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px",
              padding: "8px 12px", cursor: "pointer", fontSize: "13px",
              borderBottom: "1px solid var(--border)" }}>
              <input type="checkbox" checked={selected.includes(p.id)}
                onChange={() => toggle(p)}
                style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductForm({ product, categories, brands, onClose, onSave }) {
  const { settings: siteSettings } = useSiteSettings()
  const rates = siteSettings ? {
    usd_to_clp: Number(siteSettings.usd_to_clp) || 0,
    usd_to_ars: Number(siteSettings.usd_to_ars) || 0,
  } : null
  const [form, setForm] = useState({
    name:              product?.name              || "",
    slug:              product?.slug              || "",
    description:       product?.description       || "",
    short_description: product?.short_description || "",
    price:             product?.price             || "",
    compare_price:     product?.compare_price     || "",
    cost_price:        product?.cost_price        || "",
    price_usd:         product?.price_usd         || "",
    price_ars:         product?.price_ars         || "",
    stock:             product?.stock             ?? 0,
    stock_min:         product?.stock_min         ?? 3,
    sku:               product?.sku               || "",
    category:          product?.category?.id      || "",
    brand:             product?.brand?.id         || "",
    is_active:         product?.is_active         ?? true,
    is_featured:       product?.is_featured       ?? false,
    product_type:      product?.product_type      || "stock",
    badge:             product?.badge             || "",
    related_products:  product?.related_products?.map(p => p.id) || [],
    bundle_items:      product?.bundle_items?.map(bi => ({
                         product_id: bi.product.id,
                         quantity:   bi.quantity,
                         name:       bi.product.name,
                       })) || [],
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")
  const [activeTab, setActiveTab] = useState("basic")
  const queryClient = useQueryClient()

  // Imágenes
  const [images, setImages]         = useState(product?.images || [])
  const [uploadingImg, setUploadingImg] = useState(false)
  const [imgToDelete, setImgToDelete] = useState(null)
  const fileRef = useRef(null)

  const handleSave = async () => {
    if (!form.name || !form.price) { setError("Nombre y precio son requeridos."); return }
    setSaving(true); setError("")
    try {
      const payload = { ...form }
      if (!payload.compare_price) delete payload.compare_price
      if (!payload.cost_price)    delete payload.cost_price
      if (!payload.category)      delete payload.category
      if (!payload.brand)         delete payload.brand
      if (!payload.slug)          delete payload.slug

      // Componentes del kit: solo enviamos si es bundle, y solo los
      // campos que el backend espera (product_id, quantity)
      if (payload.product_type === "bundle") {
        payload.bundle_items = (payload.bundle_items || []).map(it => ({
          product_id: it.product_id, quantity: it.quantity,
        }))
      } else {
        delete payload.bundle_items
      }

      if (product?.id) {
        await updateAdminProduct(product.id, payload)
      } else {
        await createAdminProduct(payload)
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] })
      onSave?.()
      onClose()
    } catch (e) {
      const data = e?.response?.data
      const msg = data?.detail || (data && typeof data === "object"
        ? Object.entries(data).map(([field, msgs]) =>
            `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`).join(" · ")
        : "Error al guardar.")
      setError(msg)
    } finally { setSaving(false) }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !product?.id) return
    setUploadingImg(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      fd.append("alt_text", form.name)
      const newImg = await uploadProductImage(product.id, fd)
      setImages(prev => [...prev, newImg])
      queryClient.invalidateQueries({ queryKey: ["admin-products"] })
    } catch (e) {
      showToast(e?.response?.data?.detail || "No se pudo subir la imagen. Intentá de nuevo.", "error")
    } finally { setUploadingImg(false) }
  }

  const handleDeleteImg = async () => {
    if (!imgToDelete) return
    try {
      await deleteProductImage(imgToDelete)
      setImages(prev => prev.filter(i => i.id !== imgToDelete))
      showToast("Imagen eliminada")
    } catch {
      showToast("No se pudo eliminar la imagen. Intentá de nuevo.", "error")
    } finally {
      setImgToDelete(null)
    }
  }

  const handleSetPrimary = async (imgId) => {
    try {
      await setPrimaryImage(imgId)
      setImages(prev => prev.map(i => ({ ...i, is_primary: i.id === imgId })))
    } catch {
      showToast("No se pudo cambiar la imagen principal. Intentá de nuevo.", "error")
    }
  }

  // Calculadora de precios
  const margin = form.cost_price && form.price
    ? Math.round((1 - form.cost_price / form.price) * 100)
    : null

  const FORM_TABS = ["basic", "pricing", "stock", "images"]
  const TAB_LABELS = { basic: "Básico", pricing: "Precios", stock: "Stock", images: "Imágenes" }

  return (
    <FormModal
      open
      title={product?.id ? "Editar producto" : "Nuevo producto"}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel={product?.id ? "Guardar cambios" : "Crear producto"}
      error={null}
      maxWidth="620px"
      scrollableBody
      testId="product-modal"
    >
      {product?.id && (
        <p style={{ fontSize: "11px", color: "var(--text-3)",
          fontFamily: "monospace", marginTop: "-8px" }}>
          ID: {product.id}
        </p>
      )}

      {/* Tabs internos */}
      <div className="au-tabs hide-scroll" style={{ margin: "0 -20px", padding: "0 20px" }}>
        {FORM_TABS.map(t => (
          <button key={t} type="button" onClick={() => setActiveTab(t)} className={`au-tab${activeTab === t ? " is-active" : ""}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          {/* TAB BÁSICO */}
          {activeTab === "basic" && (
            <>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                  color: "var(--text-2)", marginBottom: "7px" }}>
                  Nombre *
                </label>
                <input value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  style={inputSt} placeholder="Nombre del producto"
                  onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    Categoría
                  </label>
                  <select value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    style={inputSt}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    Marca
                  </label>
                  <select value={form.brand}
                    onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
                    style={inputSt}>
                    <option value="">Sin marca</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                  color: "var(--text-2)", marginBottom: "7px" }}>
                  Descripción corta
                </label>
                <textarea value={form.short_description} rows={2}
                  onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))}
                  style={{ ...inputSt, resize: "vertical" }}
                  placeholder="Breve descripción del producto"
                  onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                  color: "var(--text-2)", marginBottom: "7px" }}>
                  Descripción completa
                </label>
                <textarea value={form.description} rows={4}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  style={{ ...inputSt, resize: "vertical" }}
                  placeholder="Descripción detallada, características, especificaciones..."
                  onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    Tipo de producto
                  </label>
                  <select value={form.product_type}
                    onChange={e => setForm(p => ({ ...p, product_type: e.target.value }))}
                    style={inputSt}>
                    <option value="stock">En stock</option>
                    <option value="preorder">Preorden</option>
                    <option value="on_demand">A pedido</option>
                    <option value="bundle">Kit / Combo</option>
                  </select>
                  {form.product_type === "bundle" && (
                    <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "6px" }}>
                      Los productos que componen el kit se configuran más abajo, en
                      "Componentes del kit". El precio del kit es el que pongas acá, a mano.
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    SKU
                  </label>
                  <input value={form.sku}
                    onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                    style={inputSt} placeholder="Código interno"
                    onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                {[
                  { key: "is_active",   label: "Producto activo"   },
                  { key: "is_featured", label: "Destacado en home" },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center",
                    gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                    <input type="checkbox" checked={form[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
                      style={{ accentColor: "var(--accent)", width: "15px", height: "15px" }} />
                    {label}
                  </label>
                ))}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600,
                  color: "var(--text-2)", marginBottom: "7px" }}>
                  Etiqueta destacada
                </label>
                <select value={form.badge}
                  onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}
                  style={inputSt}>
                  <option value="">Sin etiqueta</option>
                  <option value="best_seller">🔥 Best Seller</option>
                  <option value="recommended">⭐ LevelPro recomienda</option>
                  <option value="premium">💎 Profesional</option>
                  <option value="best_value">💰 Mejor relación precio/rendimiento</option>
                  <option value="new">🆕 Nuevo</option>
                </select>
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "6px" }}>
                  "Bajo pedido" y "Últimas unidades" se calculan solos según el tipo de
                  producto y el stock — no hace falta elegirlos acá.
                </p>
              </div>

              {form.product_type === "bundle" && (
                <BundleItemsPicker
                  productId={product?.id}
                  items={form.bundle_items}
                  onChange={items => setForm(p => ({ ...p, bundle_items: items }))}
                />
              )}

              <RelatedProductsPicker
                productId={product?.id}
                initialSelected={product?.related_products || []}
                selected={form.related_products}
                onChange={ids => setForm(p => ({ ...p, related_products: ids }))}
              />
            </>
          )}

          {/* TAB PRECIOS */}
          {activeTab === "pricing" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    Precio de venta * (CLP)
                  </label>
                  <input type="number" min="0" value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    style={inputSt} placeholder="0"
                    onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    Precio tachado (opcional)
                  </label>
                  <input type="number" min="0" value={form.compare_price}
                    onChange={e => setForm(p => ({ ...p, compare_price: e.target.value }))}
                    style={inputSt} placeholder="0"
                    onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                  color: "var(--text-2)", marginBottom: "7px" }}>
                  Costo / Precio de compra (CLP)
                </label>
                <input type="number" min="0" value={form.cost_price}
                  onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))}
                  style={inputSt} placeholder="0"
                  onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"} />
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "5px" }}>
                  Usado para calcular la distribución financiera automática.
                </p>
              </div>

              {/* Precios internacionales (multi-moneda) */}
              <div style={{ padding: "16px", borderRadius: "var(--r-xl)",
                background: "rgba(26,255,110,0.03)", border: "1px solid rgba(26,255,110,0.15)" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent)",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  Precios internacionales
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "14px" }}>
                  El USD es lo que se cobra al comprador argentino (vía Payoneer); el ARS es referencial.
                  Si los dejás vacíos, se calculan con la tasa configurada en Personalización.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                      color: "var(--text-2)", marginBottom: "7px" }}>Precio USD</label>
                    <input type="number" min="0" step="0.01" value={form.price_usd}
                      onChange={e => setForm(p => ({ ...p, price_usd: e.target.value }))}
                      style={inputSt} placeholder="Ej: 105.00" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                      color: "var(--text-2)", marginBottom: "7px" }}>Precio ARS</label>
                    <input type="number" min="0" value={form.price_ars}
                      onChange={e => setForm(p => ({ ...p, price_ars: e.target.value }))}
                      style={inputSt} placeholder="Ej: 120000" />
                  </div>
                </div>
                {rates && form.price > 0 && (
                  <button type="button"
                    onClick={() => {
                      const usd = rates.usd_to_clp ? (form.price / rates.usd_to_clp) : 0
                      const ars = usd * (rates.usd_to_ars || 0)
                      setForm(p => ({ ...p,
                        price_usd: usd ? usd.toFixed(2) : "",
                        price_ars: ars ? Math.round(ars).toString() : "" }))
                    }}
                    style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px",
                      padding: "7px 12px", borderRadius: "var(--r-md)", cursor: "pointer",
                      fontSize: "12px", fontWeight: 600, border: "1px solid rgba(26,255,110,0.3)",
                      background: "transparent", color: "var(--accent)" }}>
                    Calcular desde CLP (1 USD = {rates.usd_to_clp} CLP · {rates.usd_to_ars} ARS)
                  </button>
                )}
              </div>

              {/* Calculadora de márgenes */}
              {form.price > 0 && (
                <div style={{
                  padding: "18px", borderRadius: "var(--r-xl)",
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-3)",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>
                    Calculadora de márgenes
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px" }}>
                    {[
                      {
                        label: "Precio venta",
                        value: `$${Number(form.price || 0).toLocaleString("es-CL")}`,
                        color: "var(--accent-text)",
                      },
                      {
                        label: "Costo",
                        value: form.cost_price
                          ? `$${Number(form.cost_price).toLocaleString("es-CL")}`
                          : "—",
                        color: "#EF4444",
                      },
                      {
                        label: "Margen bruto",
                        value: margin !== null ? `${margin}%` : "—",
                        color: margin > 30 ? "#0F9940" : margin > 15 ? "#D97706" : "#EF4444",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <p style={{ fontSize: "11px", color: "var(--text-3)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          marginBottom: "6px" }}>
                          {label}
                        </p>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem",
                          color, lineHeight: 1 }}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                  {form.compare_price > form.price && (
                    <div style={{ marginTop: "12px", paddingTop: "12px",
                      borderTop: "1px solid var(--border)",
                      display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px",
                        borderRadius: "var(--r-full)", background: "var(--accent)",
                        color: "#000" }}>
                        -{Math.round((1 - form.price / form.compare_price) * 100)}% OFF
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        Badge visible en la tienda
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB STOCK */}
          {activeTab === "stock" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    Stock actual
                  </label>
                  <input type="number" value={form.stock}
                    onChange={e => setForm(p => ({ ...p, stock: parseInt(e.target.value) || 0 }))}
                    style={inputSt} min="0"
                    onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "7px" }}>
                    Stock mínimo (alerta)
                  </label>
                  <input type="number" value={form.stock_min}
                    onChange={e => setForm(p => ({ ...p, stock_min: parseInt(e.target.value) || 0 }))}
                    style={inputSt} min="0"
                    onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"} />
                  <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "5px" }}>
                    Aparece en alertas de inventario cuando stock ≤ mínimo.
                  </p>
                </div>
              </div>

              {/* Indicador visual de stock */}
              <div style={{
                padding: "16px 18px", borderRadius: "var(--r-xl)",
                background: "var(--surface-2)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px" }}>Estado del stock</span>
                  <span style={{
                    fontSize: "12px", fontWeight: 600,
                    color: form.stock === 0 ? "var(--danger)"
                      : form.stock <= form.stock_min ? "#D97706"
                      : "var(--accent)",
                  }}>
                    {form.stock === 0 ? "Sin stock"
                      : form.stock <= form.stock_min ? "⚠️ Bajo mínimo"
                      : "✓ OK"}
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px",
                  background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "3px",
                    width: `${Math.min(100, (form.stock / Math.max(form.stock_min * 3, 10)) * 100)}%`,
                    background: form.stock === 0 ? "var(--danger)"
                      : form.stock <= form.stock_min ? "#D97706"
                      : "var(--accent)",
                    transition: "width 400ms var(--ease)",
                  }} />
                </div>
              </div>
            </>
          )}

          {/* TAB IMÁGENES */}
          {activeTab === "images" && (
            <>
              <ConfirmationModal
                open={!!imgToDelete}
                title="¿Eliminar imagen del producto?"
                description="Esta imagen dejará de mostrarse en la ficha pública de la tienda."
                confirmLabel="Sí, eliminar"
                danger
                onConfirm={handleDeleteImg}
                onCancel={() => setImgToDelete(null)}
                testId="delete-product-image-modal"
              />
              {!product?.id ? (
                <div style={{ textAlign: "center", padding: "28px 20px",
                  color: "#71717A", fontSize: "13px",
                  background: "#FAFAFA", borderRadius: "10px",
                  border: "1px dashed #D4D4D8" }}>
                  <Image size={26} style={{ margin: "0 auto 8px", color: "#71717A" }} />
                  <p style={{ margin: 0 }}>Guarda el producto primero para poder subir imágenes.</p>
                </div>
              ) : (
                <>
                  {/* Upload */}
                  <div>
                    <input ref={fileRef} type="file" accept="image/*"
                      onChange={handleImageUpload} style={{ display: "none" }} />
                    <button type="button" onClick={() => fileRef.current?.click()}
                      disabled={uploadingImg}
                      style={{
                        width: "100%", padding: "24px",
                        borderRadius: "10px", cursor: "pointer",
                        background: "#FAFAFA",
                        border: "1.5px dashed #D4D4D8",
                        color: "#52525B", fontSize: "13px", fontWeight: 500,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}>
                      {uploadingImg ? <><Loader2 size={16} className="spin" /> Subiendo imagen…</> : <><Upload size={16} /> Subir imagen del producto</>}
                    </button>
                  </div>

                  {/* Grid de imágenes */}
                  {images.length > 0 && (
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                      {images.map(img => (
                        <div key={img.id} style={{
                          position: "relative", borderRadius: "8px",
                          overflow: "hidden",
                          border: `2px solid ${img.is_primary ? "#09090B" : "#E4E4E7"}`,
                          aspectRatio: "1",
                        }}>
                          <img src={mediaUrl(img.image)} alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {img.is_primary && (
                            <div style={{
                              position: "absolute", top: "6px", left: "6px",
                              background: "#09090B", color: "#FFFFFF",
                              fontSize: "9.5px", fontWeight: 600,
                              padding: "2px 6px", borderRadius: "4px",
                            }}>
                              PRINCIPAL
                            </div>
                          )}
                          <div style={{
                            position: "absolute", inset: 0,
                            background: "rgba(9,9,11,0)",
                            display: "flex", alignItems: "center",
                            justifyContent: "center", gap: "6px",
                            transition: "background 150ms",
                            opacity: 0,
                          }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = "rgba(9,9,11,0.55)"
                              e.currentTarget.style.opacity = "1"
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "rgba(9,9,11,0)"
                              e.currentTarget.style.opacity = "0"
                            }}
                          >
                            {!img.is_primary && (
                              <button type="button" onClick={() => handleSetPrimary(img.id)} style={{
                                padding: "4px 8px", borderRadius: "6px", fontSize: "11px",
                                background: "#FFFFFF", color: "#09090B",
                                border: "none", cursor: "pointer", fontWeight: 600,
                              }}>
                                Principal
                              </button>
                            )}
                            <button type="button" onClick={() => setImgToDelete(img.id)} aria-label="Eliminar imagen" style={{
                              padding: "4px 6px", borderRadius: "6px",
                              background: "#DC2626", color: "#FFFFFF",
                              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center",
                            }}>
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
    </FormModal>
  )
}

// ── AdminProducts ─────────────────────────────────────────────
export default function AdminProducts() {
  const navigate = useNavigate()
  const [search, setSearch]         = useState("")
  const [catFilter, setCatFilter]   = useState("")
  const [brandFilter, setBrandFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("active")  // active | inactive | all
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkOpen, setBulkOpen]     = useState(false)
  const [modal, setModal]           = useState(null) // null | "new" | product
  const [toDelete, setToDelete]     = useState(null)
  const queryClient                 = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-products", search, catFilter, brandFilter, typeFilter, statusFilter],
    queryFn:  () => getAdminProducts({
      ...(search      && { search }),
      ...(catFilter   && { category__slug: catFilter }),
      ...(brandFilter && { brand: brandFilter }),
      ...(typeFilter  && { product_type: typeFilter }),
      ...(statusFilter === "active"   && { is_active: "true"  }),
      ...(statusFilter === "inactive" && { is_active: "false" }),
    }),
  })
  const { data: categoriesData, isError: categoriesError, refetch: retryCategories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn:  () => getAdminCategories(),
  })
  const { data: brandsData, isError: brandsError, refetch: retryBrands } = useQuery({
    queryKey: ["admin-brands"],
    queryFn:  () => getAdminBrands(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); setToDelete(null) },
    onError:    (e) => {
      showToast(e?.response?.data?.detail || "No se pudo eliminar el producto. Puede estar referenciado en pedidos existentes.", "error")
      setToDelete(null)
    },
  })

  const products   = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
  const categories = Array.isArray(categoriesData) ? categoriesData : Array.isArray(categoriesData?.results) ? categoriesData.results : []
  const brands     = Array.isArray(brandsData) ? brandsData : Array.isArray(brandsData?.results) ? brandsData.results : []

  const toggleSelect = (id, e) => {
    e?.stopPropagation?.()
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length && products.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(products.map(p => p.id))
    }
  }

  const handleExport = async (fmt) => {
    try {
      const blob = await exportAdminCatalog({
        format: fmt,
        ...(search && { search }),
        ...(catFilter && { category__slug: catFilter }),
        ...(statusFilter === "active" && { is_active: "true" }),
        ...(statusFilter === "inactive" && { is_active: "false" }),
      })
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `levelpro_catalogo_pim.${fmt}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      showToast(`Catálogo exportado en formato ${fmt.toUpperCase()}`)
    } catch (e) {
      showToast(e?.response?.data?.error || "Sin permisos para exportar catálogo.", "error")
    }
  }

  const columns = [
    { key:"select", header: (
      <input
        type="checkbox"
        aria-label="Seleccionar todos"
        checked={products.length > 0 && selectedIds.length === products.length}
        onChange={toggleSelectAll}
        style={{ accentColor: "var(--accent)", cursor: "pointer" }}
      />
    ), render: p => (
      <input
        type="checkbox"
        aria-label={`Seleccionar ${p.name}`}
        checked={selectedIds.includes(p.id)}
        onClick={e => e.stopPropagation()}
        onChange={e => toggleSelect(p.id, e)}
        style={{ accentColor: "var(--accent)", cursor: "pointer" }}
      />
    )},
    { key:"name", header:"Producto", sortable:true, render:p => {
      const primaryImg = p.images?.find(img => img.is_primary) || p.images?.[0]
      const img = primaryImg ? mediaUrl(primaryImg.image) : null
      return (
        <div style={{ display:"flex", alignItems:"center", gap:"10px", minWidth:0 }}>
          <div style={{ width:"40px", height:"40px", borderRadius:"8px",
            overflow:"hidden", background:"#F4F4F5",
            border:"1px solid #E4E4E7", flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            {img
              ? <img src={img} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <Package size={16} style={{ color:"#52525B" }} />}
          </div>
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:"13.5px", fontWeight:600, color:"#09090B", overflow:"hidden",
              textOverflow:"ellipsis", whiteSpace:"nowrap", margin:0 }}>{p.name}</p>
            {p.sku && <p className="lp-mono" style={{ fontSize:"11.5px", color:"#71717A", margin:"1px 0 0" }}>{p.sku}</p>}
          </div>
        </div>
      )
    }},
    { key:"price", header:"Precio", sortable:true, align:"right", render:p => (
      <div style={{ textAlign:"right" }}>
        <p style={{ fontSize:"13px", fontWeight:600 }}>{formatCurrency(p.price, "CLP")}</p>
        {p.compare_price && <p style={{ fontSize:"11px", color:"var(--admin-text-muted)",
          textDecoration:"line-through" }}>{formatCurrency(p.compare_price, "CLP")}</p>}
      </div>
    )},
    { key:"stock", header:"Stock", sortable:true, align:"right", render:p => {
      const sVal = p.effective_stock ?? p.stock
      return (
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize:"13px", fontWeight:600,
            color: sVal === 0 ? "var(--admin-danger, #EF4444)"
              : sVal <= (p.stock_min || 3) ? "#D97706" : "inherit" }}>
            {sVal}
          </span>
          {p.admin_variants?.length > 0 && (
            <p style={{ fontSize: "10.5px", color: "var(--admin-text-muted)" }}>
              {p.admin_variants.length} var.
            </p>
          )}
        </div>
      )
    }},
    { key:"category", header:"Categoría",
      render:p => <span style={{ color:"var(--admin-text-muted)" }}>{p.category?.name || "—"}</span> },
    { key:"is_active", header:"Estado", render:p => (
      <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
        <StatusBadge tone={p.is_active ? "success" : "neutral"}>
          {p.is_active ? "Activo" : "Inactivo"}
        </StatusBadge>
        {p.is_featured && <StatusBadge tone="warning">★</StatusBadge>}
      </div>
    )},
  ]

  const totalCount = data?.count ?? products.length
  const activeCount = products.filter(p => p.is_active).length
  const featuredCount = products.filter(p => p.is_featured).length
  const lowStockCount = products.filter(p => (p.stock ?? 0) <= (p.stock_min ?? 3)).length

  return (
    <div className="au-page">

      {/* Modal */}
      {modal && (
        <ProductForm
          product={modal === "new" ? null : modal}
          categories={categories}
          brands={brands}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries({ queryKey: ["admin-products"] })}
        />
      )}

      <BulkEditModal
        open={bulkOpen}
        selectedIds={selectedIds}
        filters={{
          ...(search && { search }),
          ...(catFilter && { category_slug: catFilter }),
          ...(brandFilter && { brand_id: brandFilter }),
          ...(typeFilter && { product_type: typeFilter }),
          ...(statusFilter === "active" && { is_active: true }),
          ...(statusFilter === "inactive" && { is_active: false }),
        }}
        categories={categories}
        brands={brands}
        onClose={() => setBulkOpen(false)}
      />

      <ConfirmationModal
        open={!!toDelete}
        title="¿Eliminar producto?"
        description={toDelete ? `Se eliminará "${toDelete.name}" permanentemente.` : ""}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
        testId="delete-product-modal"
      />

      <AdminPageHeader
        eyebrow="LEVELPRO / CATÁLOGO"
        title="Productos"
        description={isLoading || isError ? "Administración del catálogo" : `${totalCount} productos en el filtro actual · ${categories.length} categorías · ${brands.length} marcas`}
        actions={
          <>
            <SecondaryButton size="sm" onClick={() => setBulkOpen(true)} data-testid="bulk-edit-btn">
              <Layers size={13} /> Edición masiva{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={() => handleExport("xlsx")} data-testid="export-xlsx-btn">
              <Download size={13} /> Exportar .xlsx
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={() => handleExport("csv")} data-testid="export-csv-btn">
              CSV
            </SecondaryButton>
            <SecondaryButton to="/admin/products/import" size="sm">
              Importar .xlsx
            </SecondaryButton>
            <SecondaryButton to="/admin/inventory" size="sm">
              Inventario
            </SecondaryButton>
            <PrimaryButton icon={Plus} onClick={() => setModal("new")} data-testid="new-product-btn">
              Nuevo producto
            </PrimaryButton>
          </>
        }
      />

      {/* La página actual no constituye un consolidado del catálogo entero. */}
      {!isLoading && !isError && <div className="lp-grid-kpi">
        <StatCard
          variant="ink"
          Icon={Package}
          label="Productos en filtro"
          value={totalCount}
          sub={`${categories.length} categorías · ${brands.length} marcas`}
        />
        <StatCard
          variant="primary"
          Icon={CheckCircle2}
          label="Activos (página)"
          value={activeCount}
          sub="En página cargada"
        />
        <StatCard
          variant="light"
          Icon={Star}
          label="Destacados (página)"
          value={featuredCount}
          sub="En página cargada"
        />
        <StatCard
          variant="light"
          Icon={AlertTriangle}
          label="Stock bajo (página)"
          value={lowStockCount}
          sub={lowStockCount > 0 ? "Revisar página cargada" : "Sin alertas en esta página"}
        />
      </div>}

      {(categoriesError || brandsError) && (
        <div className="lp-callout lp-callout--warning" role="alert">
          No pudimos cargar {categoriesError && brandsError ? "categorías ni marcas" : categoriesError ? "categorías" : "marcas"}.
          Reintenta antes de editar relaciones del catálogo.
          <SecondaryButton size="sm" onClick={() => { if (categoriesError) retryCategories(); if (brandsError) retryBrands() }}>Reintentar</SecondaryButton>
        </div>
      )}

      {/* Barra de búsqueda, categoría y estado + chips y bulk bar */}
      <div className="au-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: "1 1 340px" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre o SKU..." aria-label="Buscar producto por nombre o SKU" data-testid="products-search"
              className="au-input"
              style={{ flex: "1 1 240px", maxWidth: "320px", padding: "0 12px", height: "34px" }} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} aria-label="Filtrar por categoría"
              className="au-select"
              style={{ maxWidth: "190px", height: "34px" }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} aria-label="Filtrar por marca"
              className="au-select"
              style={{ maxWidth: "170px", height: "34px" }}>
              <option value="">Todas las marcas</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filtrar por tipo"
              className="au-select"
              style={{ maxWidth: "155px", height: "34px" }}>
              <option value="">Todos los tipos</option>
              <option value="stock">En Stock</option>
              <option value="preorder">Preorden</option>
              <option value="on_demand">A pedido</option>
              <option value="bundle">Kit / Combo</option>
            </select>
          </div>

          <div className="lp-seg-tabs">
            {[
              ["active",   "Activos"  ],
              ["inactive", "Inactivos"],
              ["all",      "Todos"    ],
            ].map(([val, label]) => (
              <button key={val} type="button" aria-pressed={statusFilter === val} onClick={() => setStatusFilter(val)}
                data-testid={`filter-status-${val}`}
                className={`lp-seg-tab${statusFilter === val ? " is-active" : ""}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <FilterChipBar
          chips={[
            ...(search ? [{ key: "q", label: `Búsqueda: ${search}`, onRemove: () => setSearch("") }] : []),
            ...(catFilter ? [{ key: "cat", label: `Categoría: ${catFilter}`, onRemove: () => setCatFilter("") }] : []),
            ...(brandFilter ? [{ key: "br", label: "Marca filtrada", onRemove: () => setBrandFilter("") }] : []),
            ...(typeFilter ? [{ key: "type", label: `Tipo: ${typeFilter}`, onRemove: () => setTypeFilter("") }] : []),
          ]}
          onClearAll={() => { setSearch(""); setCatFilter(""); setBrandFilter(""); setTypeFilter("") }}
        />

        {selectedIds.length > 0 && (
          <div className="lp-bulkbar" data-testid="products-bulk-bar">
            <span style={{ fontWeight: 600 }}>
              {selectedIds.length} producto{selectedIds.length === 1 ? "" : "s"} seleccionado{selectedIds.length === 1 ? "" : "s"}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <SecondaryButton size="sm" onClick={() => setBulkOpen(true)}>
                <Layers size={13} /> Edición masiva
              </SecondaryButton>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                style={{ background: "transparent", border: "none", color: "#D4D4D8", fontSize: 12, cursor: "pointer" }}
              >
                Deseleccionar todo
              </button>
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns} data={products} loading={isLoading} error={isError} onRetry={() => refetch()}
        getRowId={p => p.id}
        searchable={false}
        onRowClick={p => setModal(p)}
        rowActions={p => [
          { label:"Variantes & Specs", icon:SlidersHorizontal, onClick:() => navigate(`/admin/products/${p.id}`) },
          { label:"Editar rápido", icon:Pencil, onClick:() => setModal(p) },
          { label:"Eliminar", icon:Trash2, danger:true, onClick:() => setToDelete(p) },
        ]}
        emptyIcon={Package} emptyTitle="Sin productos"
        emptyDesc={search ? "No hay productos con esos términos." : "Crea el primer producto."}
        testId="products-table" />
    </div>
  )
}