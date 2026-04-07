// pages/admin/AdminProducts.jsx
import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminProducts, getAdminCategories, getAdminBrands,
  createAdminProduct, updateAdminProduct, deleteAdminProduct,
  uploadProductImage, deleteProductImage, setPrimaryImage,
} from "../../api/admin.api"
import { mediaUrl } from "../../utils/mediaUrl"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
  transition: "border-color var(--dur)",
}

// ── Formulario de producto ────────────────────────────────────
function ProductForm({ product, categories, brands, onClose, onSave }) {
  const [form, setForm] = useState({
    name:              product?.name              || "",
    slug:              product?.slug              || "",
    description:       product?.description       || "",
    short_description: product?.short_description || "",
    price:             product?.price             || "",
    compare_price:     product?.compare_price     || "",
    cost_price:        product?.cost_price        || "",
    stock:             product?.stock             ?? 0,
    stock_min:         product?.stock_min         ?? 3,
    sku:               product?.sku               || "",
    category:          product?.category?.id      || "",
    brand:             product?.brand?.id         || "",
    is_active:         product?.is_active         ?? true,
    is_featured:       product?.is_featured       ?? false,
    product_type:      product?.product_type      || "physical",
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")
  const [activeTab, setActiveTab] = useState("basic")
  const queryClient = useQueryClient()

  // Imágenes
  const [images, setImages]         = useState(product?.images || [])
  const [uploadingImg, setUploadingImg] = useState(false)
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

      if (product?.id) {
        await updateAdminProduct(product.id, payload)
      } else {
        await createAdminProduct(payload)
      }
      queryClient.invalidateQueries(["admin-products"])
      onSave?.()
      onClose()
    } catch (e) {
      setError(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || "Error al guardar.")
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
      queryClient.invalidateQueries(["admin-products"])
    } finally { setUploadingImg(false) }
  }

  const handleDeleteImg = async (imgId) => {
    if (!window.confirm("¿Eliminar imagen?")) return
    await deleteProductImage(imgId)
    setImages(prev => prev.filter(i => i.id !== imgId))
  }

  const handleSetPrimary = async (imgId) => {
    await setPrimaryImage(imgId)
    setImages(prev => prev.map(i => ({ ...i, is_primary: i.id === imgId })))
  }

  // Calculadora de precios
  const margin = form.cost_price && form.price
    ? Math.round((1 - form.cost_price / form.price) * 100)
    : null

  const FORM_TABS = ["basic", "pricing", "stock", "images"]
  const TAB_LABELS = { basic: "Básico", pricing: "Precios", stock: "Stock", images: "Imágenes" }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", width: "100%", maxWidth: "620px",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        animation: "scaleIn 200ms var(--ease)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: 500 }}>
              {product?.id ? "Editar producto" : "Nuevo producto"}
            </p>
            {product?.id && (
              <p style={{ fontSize: "11px", color: "var(--text-3)",
                fontFamily: "monospace", marginTop: "2px" }}>
                ID: {product.id}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", fontSize: "22px", lineHeight: 1,
            padding: "4px",
          }}>×</button>
        </div>

        {/* Tabs internos */}
        <div style={{
          display: "flex", gap: "0", borderBottom: "1px solid var(--border)",
          flexShrink: 0, overflowX: "auto",
        }}>
          {FORM_TABS.map(t => (
            <button key={t} type="button" onClick={() => setActiveTab(t)} style={{
              padding: "10px 20px", fontSize: "13px", cursor: "pointer",
              background: "none", border: "none",
              borderBottom: activeTab === t ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === t ? "var(--accent)" : "var(--text-3)",
              fontWeight: activeTab === t ? 500 : 400,
              marginBottom: "-1px", whiteSpace: "nowrap",
            }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Contenido scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px",
          display: "flex", flexDirection: "column", gap: "16px" }}>

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
                    <option value="physical">Físico</option>
                    <option value="digital">Digital</option>
                    <option value="service">Servicio</option>
                  </select>
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
                  <input type="number" value={form.price}
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
                  <input type="number" value={form.compare_price}
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
                <input type="number" value={form.cost_price}
                  onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))}
                  style={inputSt} placeholder="0"
                  onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"} />
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "5px" }}>
                  Usado para calcular la distribución financiera automática.
                </p>
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
                        color: "var(--accent)",
                      },
                      {
                        label: "Costo",
                        value: form.cost_price
                          ? `$${Number(form.cost_price).toLocaleString("es-CL")}`
                          : "—",
                        color: "#f87171",
                      },
                      {
                        label: "Margen bruto",
                        value: margin !== null ? `${margin}%` : "—",
                        color: margin > 30 ? "#4ade80" : margin > 15 ? "#facc15" : "#f87171",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <p style={{ fontSize: "11px", color: "var(--text-3)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          marginBottom: "6px" }}>
                          {label}
                        </p>
                        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem",
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
                      : form.stock <= form.stock_min ? "#facc15"
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
                      : form.stock <= form.stock_min ? "#facc15"
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
              {!product?.id ? (
                <div style={{ textAlign: "center", padding: "32px",
                  color: "var(--text-3)", fontSize: "14px",
                  background: "var(--surface-2)", borderRadius: "var(--r-xl)",
                  border: "1px dashed var(--border)" }}>
                  <p style={{ fontSize: "32px", marginBottom: "10px" }}>🖼️</p>
                  Guarda el producto primero para poder subir imágenes.
                </div>
              ) : (
                <>
                  {/* Upload */}
                  <div>
                    <input ref={fileRef} type="file" accept="image/*"
                      onChange={handleImageUpload} style={{ display: "none" }} />
                    <button onClick={() => fileRef.current?.click()}
                      disabled={uploadingImg}
                      style={{
                        width: "100%", padding: "32px",
                        borderRadius: "var(--r-xl)", cursor: "pointer",
                        background: "var(--surface-2)",
                        border: "2px dashed var(--border)",
                        color: "var(--text-3)", fontSize: "14px",
                        transition: "all var(--dur) var(--ease)",
                      }}>
                      {uploadingImg ? "⏳ Subiendo..." : "＋ Subir imagen"}
                    </button>
                  </div>

                  {/* Grid de imágenes */}
                  {images.length > 0 && (
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                      {images.map(img => (
                        <div key={img.id} style={{
                          position: "relative", borderRadius: "var(--r-lg)",
                          overflow: "hidden",
                          border: `2px solid ${img.is_primary ? "var(--accent)" : "var(--border)"}`,
                          aspectRatio: "1",
                        }}>
                          <img src={mediaUrl(img.image)} alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {img.is_primary && (
                            <div style={{
                              position: "absolute", top: "6px", left: "6px",
                              background: "var(--accent)", color: "#000",
                              fontSize: "9px", fontWeight: 700,
                              padding: "2px 6px", borderRadius: "3px",
                            }}>
                              PRINCIPAL
                            </div>
                          )}
                          <div style={{
                            position: "absolute", inset: 0,
                            background: "rgba(0,0,0,0)",
                            display: "flex", alignItems: "center",
                            justifyContent: "center", gap: "6px",
                            transition: "background var(--dur)",
                            opacity: 0,
                          }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = "rgba(0,0,0,0.5)"
                              e.currentTarget.style.opacity = "1"
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "rgba(0,0,0,0)"
                              e.currentTarget.style.opacity = "0"
                            }}
                          >
                            {!img.is_primary && (
                              <button onClick={() => handleSetPrimary(img.id)} style={{
                                padding: "4px 8px", borderRadius: "4px", fontSize: "10px",
                                background: "var(--accent)", color: "#000",
                                border: "none", cursor: "pointer", fontWeight: 600,
                              }}>
                                Principal
                              </button>
                            )}
                            <button onClick={() => handleDeleteImg(img.id)} style={{
                              padding: "4px 8px", borderRadius: "4px", fontSize: "10px",
                              background: "rgba(248,113,113,0.9)", color: "#fff",
                              border: "none", cursor: "pointer",
                            }}>
                              ×
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
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end",
          flexShrink: 0,
        }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "10px 20px", fontSize: "13px" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-accent"
            style={{ padding: "10px 20px", fontSize: "13px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : product?.id ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminProducts ─────────────────────────────────────────────
export default function AdminProducts() {
  const [search, setSearch]     = useState("")
  const [catFilter, setCatFilter] = useState("")
  const [modal, setModal]       = useState(null) // null | "new" | product
  const queryClient             = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search, catFilter],
    queryFn:  () => getAdminProducts({
      ...(search    && { search }),
      ...(catFilter && { category__slug: catFilter }),
    }),
  })
  const { data: categoriesData } = useQuery({
    queryKey: ["admin-categories"],
    queryFn:  () => getAdminCategories(),
  })
  const { data: brandsData } = useQuery({
    queryKey: ["admin-brands"],
    queryFn:  () => getAdminBrands(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess:  () => queryClient.invalidateQueries(["admin-products"]),
  })

  const products   = data?.results   || data   || []
  const categories = categoriesData?.results || categoriesData || []
  const brands     = brandsData?.results     || brandsData     || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Modal */}
      {modal && (
        <ProductForm
          product={modal === "new" ? null : modal}
          categories={categories}
          brands={brands}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-products"])}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px",
        flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
            letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Productos
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {data?.count || products.length} productos
          </p>
        </div>
        <button onClick={() => setModal("new")} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nuevo producto
        </button>
      </div>

      {/* Búsqueda + filtros */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px",
        flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          style={{ ...inputSt, maxWidth: "280px" }}
          onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ ...inputSt, maxWidth: "200px" }}>
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "64px" }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-2xl)" }}>
          <p style={{ fontSize: "40px", marginBottom: "12px" }}>📦</p>
          <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 300,
            fontSize: "1.4rem", marginBottom: "8px" }}>
            Sin productos
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "20px" }}>
            {search ? "No hay productos con esos términos." : "Crea el primer producto."}
          </p>
          <button onClick={() => setModal("new")} className="btn btn-accent">
            + Nuevo producto
          </button>
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          {/* Cabecera */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "56px 2.5fr 1fr 1fr 1fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span />
            <span>Producto</span>
            <span>Precio</span>
            <span>Stock</span>
            <span>Categoría</span>
            <span>Estado</span>
            <span />
          </div>

          {products.map((p, i) => {
            const primaryImg = p.images?.find(img => img.is_primary) || p.images?.[0]
            const img = primaryImg ? mediaUrl(primaryImg.image) : null

            return (
              <div key={p.id} style={{
                display: "grid",
                gridTemplateColumns: "56px 2.5fr 1fr 1fr 1fr 1fr 80px",
                padding: "12px 20px", alignItems: "center",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                transition: "background var(--dur) var(--ease)", gap: "8px",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Imagen */}
                <div style={{ width: "40px", height: "40px", borderRadius: "var(--r-md)",
                  overflow: "hidden", background: "var(--surface-2)",
                  border: "1px solid var(--border)", flexShrink: 0 }}>
                  {img ? (
                    <img src={img} alt={p.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: "18px" }}>🎧</div>
                  )}
                </div>

                {/* Nombre */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </p>
                  {p.sku && (
                    <p style={{ fontSize: "11px", color: "var(--text-3)",
                      fontFamily: "monospace" }}>
                      {p.sku}
                    </p>
                  )}
                </div>

                {/* Precio */}
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 500 }}>
                    ${Number(p.price).toLocaleString("es-CL")}
                  </p>
                  {p.compare_price && (
                    <p style={{ fontSize: "11px", color: "var(--text-3)",
                      textDecoration: "line-through" }}>
                      ${Number(p.compare_price).toLocaleString("es-CL")}
                    </p>
                  )}
                </div>

                {/* Stock */}
                <span style={{
                  fontSize: "13px", fontWeight: 500,
                  color: p.stock === 0 ? "var(--danger)"
                    : p.stock <= (p.stock_min || 3) ? "#facc15"
                    : "var(--text)",
                }}>
                  {p.stock}
                </span>

                {/* Categoría */}
                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {p.category?.name || "—"}
                </span>

                {/* Estado */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                    fontWeight: 500,
                    color:       p.is_active ? "var(--accent)" : "var(--text-3)",
                    background:  p.is_active ? "var(--accent-dim)" : "var(--surface-2)",
                    border:      `1px solid ${p.is_active ? "var(--accent-glow)" : "var(--border)"}`,
                  }}>
                    {p.is_active ? "Activo" : "Inactivo"}
                  </span>
                  {p.is_featured && (
                    <span style={{
                      padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                      fontWeight: 500, color: "#facc15",
                      background: "rgba(250,204,21,0.1)",
                      border: "1px solid rgba(250,204,21,0.25)",
                    }}>
                      ⭐
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => setModal(p)} style={{
                    padding: "5px 10px", borderRadius: "var(--r-md)",
                    fontSize: "11px", cursor: "pointer",
                    color: "#60a5fa", background: "rgba(96,165,250,0.1)",
                    border: "1px solid rgba(96,165,250,0.2)",
                  }}>
                    ✎
                  </button>
                  <button onClick={() => {
                    if (window.confirm(`¿Eliminar "${p.name}"?`))
                      deleteMutation.mutate(p.id)
                  }} style={{
                    padding: "5px 10px", borderRadius: "var(--r-md)",
                    fontSize: "11px", cursor: "pointer",
                    color: "#f87171", background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                  }}>
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}