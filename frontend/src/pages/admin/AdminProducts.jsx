// AdminProducts.jsx — reemplaza completo

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminProducts } from "../../api/admin.api"
import api from "../../api/client"

// ── Modal de producto ────────────────────────────────────────
function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    name:              product?.name || "",
    sku:               product?.sku || "",
    price:             product?.price || "",
    compare_price:     product?.compare_price || "",
    stock:             product?.stock ?? 0,
    short_description: product?.short_description || "",
    description:       product?.description || "",
    is_active:         product?.is_active ?? true,
    is_featured:       product?.is_featured ?? false,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(
    product?.images?.[0]?.image || null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      let savedProduct

      if (product?.id) {
        const { data } = await api.patch(`/admin/products/${product.id}/`, form)
        savedProduct = data
      } else {
        const { data } = await api.post("/admin/products/", form)
        savedProduct = data
      }

      // Subir imagen si hay una nueva
      if (imageFile && savedProduct?.id) {
        const formData = new FormData()
        formData.append("image",      imageFile)
        formData.append("product",    savedProduct.id)
        formData.append("is_primary", "true")
        formData.append("order",      "0")
        await api.post("/admin/product-images/", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      }

      onSave()
      onClose()
    } catch (e) {
      setError("Error al guardar. Verifica los datos.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "100%", maxWidth: "580px",
        maxHeight: "85vh", overflow: "auto",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {product?.id ? "Editar producto" : "Nuevo producto"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "20px" }}>×</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {/* Imagen */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "8px" }}>
              Imagen del producto
            </label>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{
                width: "80px", height: "80px", borderRadius: "var(--r-md)",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                overflow: "hidden", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {imagePreview ? (
                  <img src={imagePreview} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "28px" }}>🎧</span>
                )}
              </div>
              <div>
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "8px 16px", borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)", cursor: "pointer",
                  fontSize: "13px", color: "var(--text-2)",
                  transition: "all var(--dur) var(--ease)",
                  background: "var(--surface-2)",
                }}>
                  📁 Subir imagen
                  <input type="file" accept="image/*"
                    onChange={handleImage}
                    style={{ display: "none" }} />
                </label>
                <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "6px" }}>
                  JPG, PNG — máx 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Campos de texto */}
          {[
            { key: "name",              label: "Nombre *",       type: "text" },
            { key: "sku",               label: "SKU",            type: "text" },
            { key: "price",             label: "Precio *",       type: "number" },
            { key: "compare_price",     label: "Precio tachado", type: "number" },
            { key: "stock",             label: "Stock *",        type: "number" },
            { key: "short_description", label: "Descripción corta", type: "text" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>{label}</label>
              <input type={type} value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="input" />
            </div>
          ))}

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px" }}>Descripción completa</label>
            <textarea value={form.description} rows={4}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input" style={{ resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { key: "is_active",   label: "Activo" },
              { key: "is_featured", label: "Destacado" },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center",
                gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                <input type="checkbox" checked={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  style={{ width: "15px", height: "15px",
                    accentColor: "var(--accent)" }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end",
          position: "sticky", bottom: 0, background: "var(--surface)" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 20px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-accent"
            style={{ padding: "9px 20px", fontSize: "13px",
              opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminProducts ────────────────────────────────────────────
export default function AdminProducts() {
  const [search, setSearch]         = useState("")
  const [modal, setModal]           = useState(null) // null | {} | product
  const queryClient                 = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search],
    queryFn:  () => getAdminProducts({ ...(search && { search }) }),
  })

  const products  = data?.results || []
  const onSave    = () => queryClient.invalidateQueries(["admin-products"])

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal !== null && (
        <ProductModal
          product={modal}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Productos
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {data?.count || 0} productos
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nuevo producto
        </button>
      </div>

      <input
        placeholder="Buscar por nombre o SKU..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input"
        style={{ maxWidth: "320px", marginBottom: "20px" }}
      />

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid",
            gridTemplateColumns: "auto 2fr 1fr 1fr 1fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span style={{ width: "44px" }}></span>
            <span>Producto</span>
            <span>Precio</span>
            <span>Stock</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>

          {products.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No se encontraron productos.
            </div>
          ) : products.map((p, i) => (
            <div key={p.id} style={{
              display: "grid",
              gridTemplateColumns: "auto 2fr 1fr 1fr 1fr 1fr",
              padding: "12px 20px", alignItems: "center", gap: "12px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div style={{ width: "44px", height: "44px",
                borderRadius: "var(--r-sm)", background: "var(--surface-2)",
                overflow: "hidden", border: "1px solid var(--border)" }}>
                {p.images?.[0]?.image ? (
                  <img src={p.images[0].image} alt={p.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                    🎧
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize: "13px" }}>{p.name}</p>
                {p.sku && (
                  <p style={{ fontSize: "11px", color: "var(--text-3)",
                    fontFamily: "monospace" }}>{p.sku}</p>
                )}
              </div>

              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                ${Number(p.price).toLocaleString("es-CL")}
              </span>

              <span style={{
                fontSize: "13px",
                color: p.stock === 0 ? "var(--danger)"
                  : p.stock <= 5 ? "#facc15"
                  : "var(--text-2)",
                fontWeight: p.stock <= 5 ? 500 : 400,
              }}>
                {p.stock === 0 ? "Sin stock" : `${p.stock} uds.`}
              </span>

              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
                fontWeight: 500, display: "inline-block",
                color:      p.is_active ? "#4ade80" : "var(--text-3)",
                background: p.is_active ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                border:     `1px solid ${p.is_active ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
              }}>
                {p.is_active ? "Activo" : "Inactivo"}
              </span>

              <button onClick={() => setModal(p)}
                style={{ fontSize: "12px", color: "var(--text-2)",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "4px 0", transition: "color var(--dur)" }}
                className="hover:text-white">
                Editar →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}