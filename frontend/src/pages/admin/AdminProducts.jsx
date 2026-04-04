// pages/admin/AdminProducts.jsx

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminProducts, createAdminProduct, updateAdminProduct, deleteAdminProduct,
  getAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory,
  getAdminBrands, createAdminBrand, updateAdminBrand, deleteAdminBrand,
  uploadProductImage, deleteProductImage, getProductImages, setPrimaryImage
} from "../../api/admin.api"
import { mediaUrl } from "../../utils/mediaUrl"
import api from "../../api/client" 


// ── Modal base ───────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101, width: "min(680px, 95vw)",
        maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0,
          background: "var(--surface)", zIndex: 1,
        }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>{title}</p>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", fontSize: "22px", lineHeight: 1,
            padding: "2px 8px",
          }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </>
  )
}

// ── Field ────────────────────────────────────────────────────
function Field({ label, children, required }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: "12px", fontWeight: 500,
        color: "var(--text-2)", marginBottom: "7px", letterSpacing: "0.02em",
      }}>
        {label} {required && <span style={{ color: "var(--accent)" }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Formulario de Producto ───────────────────────────────────
function ProductForm({ product, onClose }) {
  const queryClient = useQueryClient()

  const { data: categoriesData } = useQuery({
    queryKey: ["admin-categories"],
    queryFn:  getAdminCategories,
  })
  const { data: brandsData } = useQuery({
    queryKey: ["admin-brands"],
    queryFn:  getAdminBrands,
  })
  // ← Imágenes existentes — sin onSuccess
  const { data: imagesData } = useQuery({
    queryKey: ["product-images", product?.id],
    queryFn:  () => getProductImages(product.id),
    enabled:  !!product?.id,
  })

  const categories     = categoriesData?.results || categoriesData || []
  const brands         = brandsData?.results     || brandsData     || []
  const existingImages = imagesData?.results     || imagesData     || []

  const [form, setForm] = useState({
    name:              product?.name              || "",
    sku:               product?.sku               || "",
    category:          product?.category?.id      || "",
    brand:             product?.brand?.id         || "",
    short_description: product?.short_description || "",
    description:       product?.description       || "",
    price:             product?.price             || "",
    compare_price:     product?.compare_price     || "",
    stock:             product?.stock             || 0,
    product_type:      product?.product_type      || "stock",
    is_active:         product?.is_active         ?? true,
    is_featured:       product?.is_featured       ?? false,
  })
  const [newImages, setNewImages] = useState([])
  const [error, setError]         = useState("")

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name:              form.name,
        short_description: form.short_description,
        description:       form.description,
        price:             form.price,
        stock:             form.stock,
        product_type:      form.product_type,
        is_active:         form.is_active,
        is_featured:       form.is_featured,
      }
      if (form.sku)           payload.sku           = form.sku
      if (form.category)      payload.category      = form.category
      if (form.brand)         payload.brand         = form.brand
      if (form.compare_price) payload.compare_price = form.compare_price

      let saved
      if (product?.id) {
        saved = await updateAdminProduct(product.id, payload)
      } else {
        saved = await createAdminProduct(payload)
      }

      // Sube imágenes nuevas una por una
      for (let i = 0; i < newImages.length; i++) {
        const img  = newImages[i]
        const fd   = new FormData()
        fd.append("image",      img.file)
        fd.append("order",      existingImages.length + i)
        fd.append("is_primary", existingImages.length === 0 && i === 0 ? "true" : "false")
        await uploadProductImage(saved.id, fd)
      }
      return saved
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-products"])
      queryClient.invalidateQueries(["product-images", product?.id])
      onClose()
    },
    onError: (e) => {
      setError(JSON.stringify(e.response?.data) || "Error al guardar.")
    },
  })

  const deleteImageMutation = useMutation({
    mutationFn: (imageId) => deleteProductImage(imageId), // ← solo imageId
    onSuccess:  () => queryClient.invalidateQueries(["product-images", product?.id]),
  })

  const primaryMutation = useMutation({
    mutationFn: (imageId) => setPrimaryImage(imageId),
    onSuccess:  () => queryClient.invalidateQueries(["product-images", product?.id]),
  })

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files)
    const added = files.map((file, i) => ({
      file,
      preview:    URL.createObjectURL(file),
      order:      existingImages.length + newImages.length + i,
      is_primary: existingImages.length === 0 && newImages.length === 0 && i === 0,
    }))
    setNewImages(prev => [...prev, ...added])
  }

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)",
    fontSize: "13px", outline: "none",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: "13px",
          background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
          color: "var(--danger)",
        }}>
          {error}
        </div>
      )}

      {/* Nombre + SKU */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
        <Field label="Nombre" required>
          <input value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            style={inputSt} placeholder="Ej: Shure SM58" />
        </Field>
        <Field label="SKU">
          <input value={form.sku}
            onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
            style={inputSt} placeholder="Ej: SHU-SM58" />
        </Field>
      </div>

      {/* Categoría + Marca */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <Field label="Categoría">
          <select value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            style={inputSt}>
            <option value="">— Sin categoría —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Marca">
          <select value={form.brand}
            onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
            style={inputSt}>
            <option value="">— Sin marca —</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Descripción corta */}
      <Field label="Descripción corta">
        <input value={form.short_description}
          onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))}
          style={inputSt} placeholder="Máx. 500 caracteres" />
      </Field>

      {/* Descripción larga */}
      <Field label="Descripción completa">
        <textarea value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={4} style={{ ...inputSt, resize: "vertical" }} />
      </Field>

      {/* Precio + Compare + Stock */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        <Field label="Precio" required>
          <input type="number" value={form.price}
            onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
            style={inputSt} min="0" placeholder="150000" />
        </Field>
        <Field label="Precio comparativo">
          <input type="number" value={form.compare_price}
            onChange={e => setForm(p => ({ ...p, compare_price: e.target.value }))}
            style={inputSt} min="0" placeholder="200000" />
        </Field>
        <Field label="Stock" required>
          <input type="number" value={form.stock}
            onChange={e => setForm(p => ({ ...p, stock: parseInt(e.target.value) || 0 }))}
            style={inputSt} min="0" />
        </Field>
      </div>

      {/* Tipo + Estado + Destacado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        <Field label="Tipo">
          <select value={form.product_type}
            onChange={e => setForm(p => ({ ...p, product_type: e.target.value }))}
            style={inputSt}>
            <option value="stock">En stock</option>
            <option value="preorder">Preorden</option>
            <option value="on_demand">A pedido</option>
          </select>
        </Field>
        <Field label="Estado">
          <select value={form.is_active ? "1" : "0"}
            onChange={e => setForm(p => ({ ...p, is_active: e.target.value === "1" }))}
            style={inputSt}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>
        </Field>
        <Field label="Destacado">
          <select value={form.is_featured ? "1" : "0"}
            onChange={e => setForm(p => ({ ...p, is_featured: e.target.value === "1" }))}
            style={inputSt}>
            <option value="0">No</option>
            <option value="1">Sí</option>
          </select>
        </Field>
      </div>

      {/* ── Imágenes existentes ── */}
      {existingImages.length > 0 && (
        <Field label={`Imágenes actuales (${existingImages.length})`}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {existingImages.map(img => (
              <div key={img.id} style={{ position: "relative" }}>
                <img
                  src={mediaUrl(img.image)}
                  alt={img.alt_text || ""}
                  style={{
                    width: "80px", height: "80px", objectFit: "cover",
                    borderRadius: "var(--r-sm)",
                    border: img.is_primary
                      ? "2px solid var(--accent)"
                      : "1px solid var(--border)",
                  }}
                />
                {img.is_primary && (
                  <span style={{
                    position: "absolute", top: "3px", left: "3px",
                    fontSize: "9px", fontWeight: 700,
                    background: "var(--accent)", color: "#000",
                    padding: "1px 5px", borderRadius: "3px",
                  }}>
                    PRINCIPAL
                  </span>
                )}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  display: "flex", gap: "3px", padding: "4px",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
                  borderRadius: "0 0 var(--r-sm) var(--r-sm)",
                }}>
                  {!img.is_primary && (
                    <button
                      onClick={() => primaryMutation.mutate(img.id)}
                      disabled={primaryMutation.isPending}
                      title="Hacer principal"
                      style={{
                        flex: 1, padding: "3px", borderRadius: "3px",
                        fontSize: "10px", cursor: "pointer", fontWeight: 600,
                        background: "rgba(26,255,110,0.3)",
                        border: "1px solid rgba(26,255,110,0.5)",
                        color: "var(--accent)",
                      }}>
                      ★
                    </button>
                  )}
                  <button
                    onClick={() => deleteImageMutation.mutate(img.id)}
                    disabled={deleteImageMutation.isPending}
                    title="Eliminar"
                    style={{
                      flex: 1, padding: "3px", borderRadius: "3px",
                      fontSize: "10px", cursor: "pointer", fontWeight: 600,
                      background: "rgba(255,59,59,0.3)",
                      border: "1px solid rgba(255,59,59,0.5)",
                      color: "#f87171",
                    }}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Field>
      )}

      {/* ── Nuevas imágenes a subir ── */}
      <Field label="Agregar imágenes nuevas">
        <label style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "var(--r-md)",
          border: "2px dashed var(--border)", cursor: "pointer",
          color: "var(--text-2)", fontSize: "13px",
          transition: "border-color var(--dur)",
          marginBottom: newImages.length > 0 ? "10px" : "0",
        }}
          className="hover:border-[var(--border-hover)]"
        >
          <span style={{ fontSize: "20px" }}>📎</span>
          Seleccionar imágenes (puedes elegir varias)
          <input type="file" accept="image/*" multiple
            onChange={handleImageAdd} style={{ display: "none" }} />
        </label>

        {newImages.length > 0 && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {newImages.map((img, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={img.preview} alt=""
                  style={{
                    width: "80px", height: "80px", objectFit: "cover",
                    borderRadius: "var(--r-sm)",
                    border: img.is_primary
                      ? "2px solid var(--accent)"
                      : "1px solid var(--border)",
                  }} />
                {img.is_primary && (
                  <span style={{
                    position: "absolute", top: "3px", left: "3px",
                    fontSize: "9px", fontWeight: 700,
                    background: "var(--accent)", color: "#000",
                    padding: "1px 5px", borderRadius: "3px",
                  }}>
                    PRINCIPAL
                  </span>
                )}
                <button
                  onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))}
                  style={{
                    position: "absolute", top: "-6px", right: "-6px",
                    width: "18px", height: "18px", borderRadius: "50%",
                    background: "var(--danger)", border: "none",
                    color: "#fff", fontSize: "11px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>

      {/* Botones */}
      <div style={{
        display: "flex", gap: "10px", justifyContent: "flex-end",
        paddingTop: "8px", borderTop: "1px solid var(--border)",
      }}>
        <button onClick={onClose} className="btn btn-ghost"
          style={{ padding: "10px 20px" }}>
          Cancelar
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !form.name || !form.price}
          className="btn btn-accent"
          style={{ padding: "10px 24px", opacity: saveMutation.isPending ? 0.6 : 1 }}>
          {saveMutation.isPending ? "Guardando..." :
            product ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </div>
  )
}
// ── Formulario de Categoría ──────────────────────────────────
function CategoryForm({ category, categories, onClose }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: category?.name || "",
    description: category?.description || "",
    parent: category?.parent || "",
    order: category?.order || 0,
    is_active: category?.is_active ?? true,
  })
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: () => {
      // Solo usa FormData si hay imagen
      if (imageFile) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== "") fd.append(k, v)
        })
        fd.append("image", imageFile)
        return category
          ? updateAdminCategory(category.id, fd)
          : createAdminCategory(fd)
      }
      // Sin imagen — envía JSON directo
      const payload = { ...form }
      if (!payload.parent) delete payload.parent
      return category
        ? updateAdminCategory(category.id, payload)
        : createAdminCategory(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-categories"])
      onClose()
    },
    onError: (e) => setError(JSON.stringify(e.response?.data) || "Error al guardar."),
  })
  const [imageFile, setImageFile] = useState(null)

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
  }

  // Filtra la categoría actual para evitar que sea su propio padre
  const parentOptions = categories.filter(c => c.id !== category?.id)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)",
          background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
          color: "var(--danger)", fontSize: "13px"
        }}>
          {error}
        </div>
      )}

      <Field label="Nombre" required>
        <input value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          style={inputSt} placeholder="Ej: Audio Pro" />
      </Field>

      <Field label="Categoría padre (opcional)">
        <select value={form.parent}
          onChange={e => setForm(p => ({ ...p, parent: e.target.value || null }))}
          style={inputSt}>
          <option value="">— Categoría raíz —</option>
          {parentOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Descripción">
        <textarea value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={3} style={{ ...inputSt, resize: "vertical" }} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <Field label="Orden">
          <input type="number" value={form.order}
            onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
            style={inputSt} min="0" />
        </Field>
        <Field label="Estado">
          <select value={form.is_active ? "1" : "0"}
            onChange={e => setForm(p => ({ ...p, is_active: e.target.value === "1" }))}
            style={inputSt}>
            <option value="1">Activa</option>
            <option value="0">Inactiva</option>
          </select>
        </Field>
      </div>

      <div>
        <Field label="Imagen (opcional)">
          <label style={{
            padding: "10px 16px", borderRadius: "var(--r-md)",
            border: "2px dashed var(--border)", cursor: "pointer",
            color: "var(--text-2)", fontSize: "13px", display: "inline-block",
            transition: "border-color var(--dur)",
          }}
            className="hover:border-[var(--border-hover)]"
          >
            {imageFile ? `✓ ${imageFile.name}` : "Subir imagen (opcional)"}
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => setImageFile(e.target.files[0] || null)} />
          </label>
        </Field>
      </div>


      <div style={{
        display: "flex", gap: "10px", justifyContent: "flex-end",
        paddingTop: "8px", borderTop: "1px solid var(--border)"
      }}>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: "10px 20px" }}>
          Cancelar
        </button>
        <button onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name}
          className="btn btn-accent"
          style={{ padding: "10px 24px", opacity: mutation.isPending ? 0.6 : 1 }}>
          {mutation.isPending ? "Guardando..." :
            category ? "Guardar cambios" : "Crear categoría"}
        </button>
      </div>
    </div>
  )
}

function SortableCategoryRow({ cat, categories, onEdit, onDelete }) {
  // Normaliza parent
  const getId    = (val) => (val && typeof val === "object" ? val.id : val)
  const parentId = getId(cat.parent)
  const isChild  = !!parentId
  const parentName = isChild
    ? categories.find(c => c.id === parentId)?.name
    : null

  const { attributes, listeners, setNodeRef,
    transform, transition, isDragging } = useSortable({ id: cat.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "grid", gridTemplateColumns: "32px 2fr 1.5fr 1fr 1fr 80px",
        padding: "13px 20px", alignItems: "center",
        borderTop: "1px solid var(--border)",
        transition: transition || "all var(--dur) var(--ease)",
        transform: CSS.Transform.toString(transform),
        background: isDragging
          ? "var(--surface-3)"
          : isChild
            ? "rgba(255,255,255,0.01)"  // ← fondo levemente diferente para hijos
            : "transparent",
        opacity: isDragging ? 0.8 : 1,
      }}
      className="hover:bg-[var(--surface-2)]"
    >
      {/* Handle */}
      <div {...attributes} {...listeners}
        style={{ cursor: "grab", color: "var(--text-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", userSelect: "none" }}
        title="Arrastrar">
        ⠿
      </div>

      {/* Nombre con indentación si es hijo */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {isChild && (
          <span style={{ color: "var(--border)", fontSize: "13px",
            paddingLeft: "12px", flexShrink: 0 }}>
            └
          </span>
        )}
        <span style={{
          fontSize: "13px",
          color: isChild ? "var(--text-2)" : "var(--text)",
          fontWeight: isChild ? 400 : 500,
        }}>
          {cat.name}
        </span>
      </div>

      {/* Padre */}
      <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
        {parentName || "—"}
      </span>

      <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{cat.order}</span>

      <span style={{
        fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
        fontWeight: 500, display: "inline-block",
        color:      cat.is_active ? "#4ade80" : "var(--text-3)",
        background: cat.is_active ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
        border:     `1px solid ${cat.is_active ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
      }}>
        {cat.is_active ? "Activa" : "Inactiva"}
      </span>

      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={() => onEdit(cat)}
          style={{ padding: "5px 10px", borderRadius: "100px", fontSize: "11px",
            cursor: "pointer", color: "#60a5fa",
            background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}>
          ✎
        </button>
        <button onClick={() => onDelete(cat)}
          style={{ padding: "5px 10px", borderRadius: "100px", fontSize: "11px",
            cursor: "pointer", color: "#f87171",
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
          ×
        </button>
      </div>
    </div>
  )
}

// ── Formulario de Marca ──────────────────────────────────────
function BrandForm({ brand, onClose }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: brand?.name || "",
    website: brand?.website || "",
    is_active: brand?.is_active ?? true,
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setPreview] = useState(brand?.logo || null)
  const [error, setError] = useState("")

  const mutation = useMutation({
  mutationFn: () => {
    // ← SIEMPRE usar FormData, nunca JSON cuando hay archivos
    const fd = new FormData()
    fd.append("name",      form.name)
    fd.append("website",   form.website   || "")
    fd.append("is_active", form.is_active)
    if (logoFile) fd.append("logo", logoFile)
    
    return brand
      ? updateAdminBrand(brand.id, fd)
      : createAdminBrand(fd)
  },
  onSuccess: () => {
    queryClient.invalidateQueries(["admin-brands"])
    onClose()
  },
  onError: (e) => setError(JSON.stringify(e.response?.data) || "Error al guardar."),
})

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)",
          background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
          color: "var(--danger)", fontSize: "13px"
        }}>
          {error}
        </div>
      )}

      <Field label="Nombre" required>
        <input value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          style={inputSt} placeholder="Ej: Shure" />
      </Field>

      <Field label="Sitio web">
        <input value={form.website}
          onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
          style={inputSt} placeholder="https://www.shure.com" />
      </Field>

      {/* Logo */}
      <Field label="Logo de la marca">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {logoPreview && (
            <img src={mediaUrl(logoPreview)} alt="Logo"
              style={{
                width: "64px", height: "64px", objectFit: "contain",
                borderRadius: "var(--r-sm)", border: "1px solid var(--border)",
                background: "var(--surface-2)", padding: "8px"
              }} />
          )}
          <label style={{
            padding: "10px 16px", borderRadius: "var(--r-md)",
            border: "2px dashed var(--border)", cursor: "pointer",
            color: "var(--text-2)", fontSize: "13px",
            transition: "border-color var(--dur)",
          }}
            className="hover:border-[var(--border-hover)]"
          >
            {logoPreview ? "Cambiar logo" : "Subir logo"}
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0]
                if (file) {
                  setLogoFile(file)
                  setPreview(URL.createObjectURL(file))
                }
              }} />
          </label>
        </div>
      </Field>

      <Field label="Estado">
        <select value={form.is_active ? "1" : "0"}
          onChange={e => setForm(p => ({ ...p, is_active: e.target.value === "1" }))}
          style={inputSt}>
          <option value="1">Activa</option>
          <option value="0">Inactiva</option>
        </select>
      </Field>

      <div style={{
        display: "flex", gap: "10px", justifyContent: "flex-end",
        paddingTop: "8px", borderTop: "1px solid var(--border)"
      }}>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: "10px 20px" }}>
          Cancelar
        </button>
        <button onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name}
          className="btn btn-accent"
          style={{ padding: "10px 24px", opacity: mutation.isPending ? 0.6 : 1 }}>
          {mutation.isPending ? "Guardando..." :
            brand ? "Guardar cambios" : "Crear marca"}
        </button>
      </div>
    </div>
  )
}

function ImagePanel({ product, onClose }) {
  const queryClient = useQueryClient()
  const fileRef = useRef(null)

  const { data: imagesData, isLoading } = useQuery({
    queryKey: ["product-images", product.id],
    queryFn: () => getProductImages(product.id),
  })
  const images = imagesData?.results || imagesData || []

  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append("image", file)
      return uploadProductImage(product.id, fd)
    },
    onSuccess: () => queryClient.invalidateQueries(["product-images", product.id]),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProductImage,
    onSuccess: () => queryClient.invalidateQueries(["product-images", product.id]),
  })

  const primaryMutation = useMutation({
    mutationFn: setPrimaryImage,
    onSuccess: () => queryClient.invalidateQueries(["product-images", product.id]),
  })

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: "440px", zIndex: 100,
      background: "var(--surface)",
      borderLeft: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <p style={{
            fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: "4px"
          }}>Imágenes</p>
          <p style={{
            fontSize: "14px", fontWeight: 500, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px"
          }}>
            {product.name}
          </p>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none",
          cursor: "pointer", color: "var(--text-3)", fontSize: "20px"
        }}
          className="hover:text-white">×</button>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* Upload */}
        <input
          ref={fileRef} type="file" accept="image/*" multiple
          style={{ display: "none" }}
          onChange={e => {
            Array.from(e.target.files).forEach(f => uploadMutation.mutate(f))
            e.target.value = ""
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
          style={{
            width: "100%", padding: "14px",
            borderRadius: "var(--r-md)", fontSize: "13px",
            border: "2px dashed var(--border)",
            background: "transparent", color: "var(--text-2)",
            cursor: "pointer", marginBottom: "20px",
            transition: "all var(--dur) var(--ease)",
          }}
          className="hover:border-[var(--border-hover)] hover:text-white"
        >
          {uploadMutation.isPending
            ? "Subiendo..."
            : "+ Agregar imágenes (puedes seleccionar varias)"}
        </button>

        {/* Grid de imágenes */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "1" }} />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 0",
            color: "var(--text-3)", fontSize: "13px"
          }}>
            Sin imágenes todavía. Agrega la primera arriba.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {images.map(img => (
              <div key={img.id} style={{
                position: "relative", borderRadius: "var(--r-md)",
                overflow: "hidden", border: `2px solid ${img.is_primary
                  ? "var(--accent)" : "var(--border)"}`,
                aspectRatio: "1",
              }}>
                <img src={mediaUrl(img.image)} alt={img.alt_text}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                {/* Badge principal */}
                {img.is_primary && (
                  <span style={{
                    position: "absolute", top: "8px", left: "8px",
                    padding: "2px 8px", borderRadius: "100px",
                    background: "var(--accent)", color: "#000",
                    fontSize: "10px", fontWeight: 600,
                  }}>
                    Principal
                  </span>
                )}

                {/* Acciones */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  padding: "8px", display: "flex", gap: "6px",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                }}>
                  {!img.is_primary && (
                    <button
                      onClick={() => primaryMutation.mutate(img.id)}
                      disabled={primaryMutation.isPending}
                      style={{
                        flex: 1, padding: "5px 8px", borderRadius: "var(--r-sm)",
                        fontSize: "11px", fontWeight: 500, cursor: "pointer",
                        background: "rgba(26,255,110,0.2)",
                        border: "1px solid rgba(26,255,110,0.4)",
                        color: "var(--accent)",
                      }}>
                      Principal
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm("¿Eliminar esta imagen?")) {
                        deleteMutation.mutate(img.id)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    style={{
                      flex: 1, padding: "5px 8px", borderRadius: "var(--r-sm)",
                      fontSize: "11px", fontWeight: 500, cursor: "pointer",
                      background: "rgba(255,59,59,0.2)",
                      border: "1px solid rgba(255,59,59,0.3)",
                      color: "var(--danger)",
                    }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
// ── AdminProducts ────────────────────────────────────────────
export default function AdminProducts() {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("products")
  const [modal, setModal] = useState(null)
  const [imagePanel, setImagePanel] = useState(null)
  // modal = { type: "product"|"category"|"brand", item: null|object }

  const queryClient = useQueryClient()

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: () => getAdminProducts({ ...(search && { search }) }),
  })
  const { data: categoriesData, isLoading: loadingCats } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: getAdminCategories,
  })
  const { data: brandsData, isLoading: loadingBrands } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: getAdminBrands,
  })

  const products = productsData?.results || productsData || []
  const categories = categoriesData?.results || categoriesData || []
  const brands = brandsData?.results || brandsData || []

  const deleteProdMutation = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: () => queryClient.invalidateQueries(["admin-products"]),
  })
  const deleteCatMutation = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess: () => queryClient.invalidateQueries(["admin-categories"]),
  })
  const deleteBrandMutation = useMutation({
    mutationFn: deleteAdminBrand,
    onSuccess: () => queryClient.invalidateQueries(["admin-brands"]),
  })

  const tabs = [
    { key: "products", label: `Productos (${products.length})` },
    { key: "categories", label: `Categorías (${categories.length})` },
    { key: "brands", label: `Marcas (${brands.length})` },
  ]

  const rowSt = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "13px 20px", gap: "12px",
    transition: "background var(--dur) var(--ease)",
  }
  const actionBtnSt = (color) => ({
    padding: "5px 12px", borderRadius: "100px", fontSize: "12px",
    cursor: "pointer", border: "1px solid",
    transition: "all var(--dur) var(--ease)",
    color, background: `${color}14`, borderColor: `${color}30`,
  })

    // ── Estado para el orden local
  const [sortedCats, setSortedCats] = useState([])
  const [savingOrder, setSavingOrder] = useState(false)

  useEffect(() => {
  if (!categories.length) return

  const toStr = (val) => {
    if (!val) return null
    if (typeof val === "object") return String(val.id)
    return String(val)
  }

  const parents = categories
    .filter(c => !c.parent)
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const ordered = []
  parents.forEach(parent => {
    ordered.push(parent)
    const children = categories
      .filter(c => toStr(c.parent) === toStr(parent.id))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    ordered.push(...children)
  })

  const orphans = categories.filter(c =>
    c.parent && !categories.find(p => toStr(p.id) === toStr(c.parent))
  )
  ordered.push(...orphans)

  setSortedCats(ordered)
}, [categories])

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSortedCats(prev => {
      const oldIdx = prev.findIndex(c => c.id === active.id)
      const newIdx = prev.findIndex(c => c.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const saveOrder = async () => {
    setSavingOrder(true)
    try {
      await Promise.all(
        sortedCats.map((cat, idx) =>
          api.patch(`/admin/categories/${cat.id}/`, { order: idx + 1 })
        )
      )
      queryClient.invalidateQueries(["admin-categories"])
    } catch (e) {
      console.error(e)
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "24px",
        flexWrap: "wrap", gap: "16px"
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px"
          }}>
            Productos
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            Gestión completa de catálogo
          </p>
        </div>
        <button
          onClick={() => setModal({
            type: tab === "categories" ? "category"
              : tab === "brands" ? "brand" : "product", item: null
          })}
          className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + {tab === "categories" ? "Nueva categoría"
            : tab === "brands" ? "Nueva marca"
              : "Nuevo producto"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
            cursor: "pointer", transition: "all var(--dur) var(--ease)",
            background: tab === key ? "var(--text)" : "transparent",
            color: tab === key ? "var(--bg)" : "var(--text-2)",
            border: `1px solid ${tab === key ? "var(--text)" : "var(--border)"}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Búsqueda — solo productos */}
      {tab === "products" && (
        <input
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ maxWidth: "320px", marginBottom: "16px" }}
        />
      )}

      {/* ── TAB PRODUCTOS ── */}
      {tab === "products" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden"
        }}>

          {/* Header tabla */}
          <div style={{
            display: "grid", gridTemplateColumns: "44px 2fr 1fr 1fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span />
            <span>Producto</span>
            <span>Categoría</span>
            <span>Precio</span>
            <span>Stock</span>
            <span>Acciones</span>
          </div>

          {loadingProducts ? (
            <div style={{
              padding: "20px", display: "flex",
              flexDirection: "column", gap: "8px"
            }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "52px" }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{
              padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px"
            }}>
              No se encontraron productos.
            </div>
          ) : products.map((p, i) => (
            <div key={p.id} style={{
              ...rowSt,
              display: "grid", gridTemplateColumns: "44px 2fr 1fr 1fr 1fr 80px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div style={{
                width: "40px", height: "40px", borderRadius: "var(--r-sm)",
                background: "var(--surface-2)", overflow: "hidden",
                border: "1px solid var(--border)"
              }}>
                {p.primary_image ? (  // ← usa primary_image del serializer
                  <img src={mediaUrl(p.primary_image || p.images?.[0]?.image)} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : p.images?.[0]?.image ? (
                  <img src={p.images[0].image} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: "100%", height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: "16px"
                  }}>
                    🎧
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: "13px", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  {p.name}
                </p>
                {p.sku && (
                  <p style={{
                    fontSize: "11px", color: "var(--text-3)",
                    fontFamily: "monospace"
                  }}>{p.sku}</p>
                )}
              </div>

              <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                {p.category?.name || "—"}
              </span>

              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                ${Number(p.price).toLocaleString("es-CL")}
              </span>

              <span style={{
                fontSize: "13px", fontWeight: p.stock <= 5 ? 600 : 400,
                color: p.stock === 0 ? "var(--danger)"
                  : p.stock <= 5 ? "#facc15" : "var(--text-2)",
              }}>
                {p.stock === 0 ? "Sin stock" : `${p.stock}`}
              </span>

              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setModal({ type: "product", item: p })}
                  style={actionBtnSt("#60a5fa")}>
                  ✎
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar "${p.name}"?`)) {
                      deleteProdMutation.mutate(p.id)
                    }
                  }}
                  style={actionBtnSt("#f87171")}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB CATEGORÍAS ── */}
      {tab === "categories" && (
  <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)", overflow: "hidden" }}>

    {/* Botón guardar orden */}
    <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)",
      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
        ⠿ Arrastrá las filas para reordenar
      </p>
      <button onClick={saveOrder} disabled={savingOrder}
        className="btn btn-accent"
        style={{ padding: "7px 16px", fontSize: "12px", opacity: savingOrder ? 0.6 : 1 }}>
        {savingOrder ? "Guardando..." : "Guardar orden"}
      </button>
    </div>

    {/* Header */}
    <div style={{ display: "grid", gridTemplateColumns: "32px 2fr 1.5fr 1fr 1fr 80px",
      padding: "10px 20px", borderBottom: "1px solid var(--border)",
      fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
      textTransform: "uppercase", letterSpacing: "0.08em" }}>
      <span></span>
      <span>Nombre</span><span>Padre</span>
      <span>Orden</span><span>Estado</span><span>Acciones</span>
    </div>

    {loadingCats ? (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: "48px" }} />
        ))}
      </div>
    ) : (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedCats.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {sortedCats.map(c => (
            <SortableCategoryRow
              key={c.id}
              cat={c}
              categories={sortedCats}
              onEdit={(cat) => setModal({ type: "category", item: cat })}
              onDelete={(cat) => {
                if (window.confirm(`¿Eliminar "${cat.name}"?`)) {
                  deleteCatMutation.mutate(cat.id)
                }
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
    )}
  </div>
)}
    

      {/* ── TAB MARCAS ── */}
      {tab === "brands" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden"
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "44px 2fr 2fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span />
            <span>Nombre</span>
            <span>Sitio web</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>

          {loadingBrands ? (
            <div style={{
              padding: "20px", display: "flex",
              flexDirection: "column", gap: "8px"
            }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "48px" }} />
              ))}
            </div>
          ) : brands.length === 0 ? (
            <div style={{
              padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px"
            }}>
              No hay marcas. Crea la primera.
            </div>
          ) : brands.map((b, i) => (
            <div key={b.id} style={{
              ...rowSt,
              display: "grid", gridTemplateColumns: "44px 2fr 2fr 1fr 80px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div style={{
                width: "40px", height: "40px",
                background: "var(--surface-2)", borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)", display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: "6px", overflow: "hidden"
              }}>
                {b.logo ? (
                  <img src={mediaUrl(b.logo)} alt={b.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: "16px" }}>🏷️</span>
                )}
              </div>

              <span style={{ fontSize: "13px", fontWeight: 500 }}>{b.name}</span>

              <a href={b.website} target="_blank" rel="noreferrer"
                style={{
                  fontSize: "12px", color: "var(--text-3)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  transition: "color var(--dur)"
                }}
                className="hover:text-white">
                {b.website || "—"}
              </a>

              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
                fontWeight: 500, display: "inline-block",
                color: b.is_active ? "#4ade80" : "var(--text-3)",
                background: b.is_active ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                border: `1px solid ${b.is_active ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
              }}>
                {b.is_active ? "Activa" : "Inactiva"}
              </span>

              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setModal({ type: "brand", item: b })}
                  style={actionBtnSt("#60a5fa")}>✎</button>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar marca "${b.name}"?`)) {
                      deleteBrandMutation.mutate(b.id)
                    }
                  }}
                  style={actionBtnSt("#f87171")}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modal?.type === "product" && (
        <Modal
          title={modal.item ? `Editar: ${modal.item.name}` : "Nuevo producto"}
          onClose={() => setModal(null)}
        >
          <ProductForm
            product={modal.item}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "category" && (
        <Modal
          title={modal.item ? `Editar: ${modal.item.name}` : "Nueva categoría"}
          onClose={() => setModal(null)}
        >
          <CategoryForm
            category={modal.item}
            categories={categories}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "brand" && (
        <Modal
          title={modal.item ? `Editar: ${modal.item.name}` : "Nueva marca"}
          onClose={() => setModal(null)}
        >
          <BrandForm
            brand={modal.item}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}