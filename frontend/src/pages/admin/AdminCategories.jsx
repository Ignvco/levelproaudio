// pages/admin/AdminCategories.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminCategories, createAdminCategory,
  updateAdminCategory, deleteAdminCategory,
} from "../../api/admin.api"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
}

function CategoryModal({ category, categories, onClose, onSave }) {
  const [form, setForm]   = useState({
    name:        category?.name        || "",
    slug:        category?.slug        || "",
    description: category?.description || "",
    parent:      category?.parent      || "",
    is_active:   category?.is_active   ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return }
    setSaving(true); setError("")
    try {
      const payload = { ...form, parent: form.parent || null, slug: form.slug || undefined }
      if (category?.id) await updateAdminCategory(category.id, payload)
      else await createAdminCategory(payload)
      onSave(); onClose()
    } catch (e) {
      setError(e?.response?.data?.name?.[0] || e?.response?.data?.slug?.[0] || "Error al guardar.")
    } finally { setSaving(false) }
  }

  const parents = categories.filter(c => !c.parent && c.id !== category?.id)

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)", width: "100%", maxWidth: "420px",
        animation: "scaleIn 200ms var(--ease)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {category?.id ? "Editar categoría" : "Nueva categoría"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "22px" }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>{error}</div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Nombre *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={inputSt} placeholder="Nombre de la categoría"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Slug (URL)</label>
            <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
              style={{ ...inputSt, fontFamily: "monospace" }}
              placeholder="se-genera-solo"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Categoría padre</label>
            <select value={form.parent}
              onChange={e => setForm(p => ({ ...p, parent: e.target.value }))}
              style={inputSt}>
              <option value="">Sin padre (categoría raíz)</option>
              {parents.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Descripción</label>
            <textarea value={form.description} rows={2}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={{ ...inputSt, resize: "vertical" }}
              placeholder="Descripción opcional"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px",
            cursor: "pointer", fontSize: "13px" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              style={{ accentColor: "var(--accent)" }} />
            Categoría activa
          </label>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminCategories() {
  const [modal, setModal]   = useState(null)
  const queryClient         = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"], queryFn: getAdminCategories,
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess:  () => queryClient.invalidateQueries(["admin-categories"]),
  })
  const categories = data?.results || data || []
  const roots      = categories.filter(c => !c.parent)
  const children   = categories.filter(c => c.parent)

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal && (
        <CategoryModal
          category={modal === "new" ? null : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-categories"])}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
            letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Categorías
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {categories.length} categorías · {roots.length} principales
          </p>
        </div>
        <button onClick={() => setModal("new")} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nueva categoría
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Nombre</span><span>Slug</span>
            <span>Productos</span><span>Estado</span><span />
          </div>

          {/* Categorías raíz con sus hijos */}
          {roots.map((cat, i) => {
            const kids = children.filter(c => c.parent === cat.id)
            return (
              <div key={cat.id}>
                {/* Padre */}
                <div style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 80px",
                  padding: "13px 20px", alignItems: "center",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  gap: "8px",
                  transition: "background var(--dur) var(--ease)",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <p style={{ fontSize: "13px", fontWeight: 500 }}>{cat.name}</p>
                  <span style={{ fontSize: "12px", fontFamily: "monospace",
                    color: "var(--text-3)" }}>{cat.slug}</span>
                  <span style={{ fontSize: "13px" }}>{cat.products_count ?? 0}</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                    fontWeight: 500, display: "inline-block",
                    color:      cat.is_active ? "var(--accent)" : "var(--text-3)",
                    background: cat.is_active ? "var(--accent-dim)" : "var(--surface-2)",
                    border:     `1px solid ${cat.is_active ? "var(--accent-glow)" : "var(--border)"}`,
                  }}>
                    {cat.is_active ? "Activa" : "Inactiva"}
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => setModal(cat)} style={{
                      padding: "4px 8px", borderRadius: "var(--r-sm)",
                      fontSize: "11px", cursor: "pointer",
                      color: "#60a5fa", background: "rgba(96,165,250,0.1)",
                      border: "1px solid rgba(96,165,250,0.2)",
                    }}>✎</button>
                    <button onClick={() => {
                      if (window.confirm(`¿Eliminar "${cat.name}"?`))
                        deleteMutation.mutate(cat.id)
                    }} style={{
                      padding: "4px 8px", borderRadius: "var(--r-sm)",
                      fontSize: "11px", cursor: "pointer",
                      color: "#f87171", background: "rgba(248,113,113,0.1)",
                      border: "1px solid rgba(248,113,113,0.2)",
                    }}>×</button>
                  </div>
                </div>

                {/* Sub-categorías */}
                {kids.map(kid => (
                  <div key={kid.id} style={{
                    display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 80px",
                    padding: "10px 20px 10px 36px", alignItems: "center",
                    borderTop: "1px solid var(--border)", gap: "8px",
                    background: "var(--bg-2)",
                    transition: "background var(--dur) var(--ease)",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--bg-2)"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "var(--text-3)", fontSize: "12px" }}>└</span>
                      <p style={{ fontSize: "13px", color: "var(--text-2)" }}>{kid.name}</p>
                    </div>
                    <span style={{ fontSize: "12px", fontFamily: "monospace",
                      color: "var(--text-3)" }}>{kid.slug}</span>
                    <span style={{ fontSize: "13px" }}>{kid.products_count ?? 0}</span>
                    <span style={{
                      padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: "11px",
                      fontWeight: 500, display: "inline-block",
                      color:      kid.is_active ? "var(--accent)" : "var(--text-3)",
                      background: kid.is_active ? "var(--accent-dim)" : "var(--surface-2)",
                      border:     `1px solid ${kid.is_active ? "var(--accent-glow)" : "var(--border)"}`,
                    }}>
                      {kid.is_active ? "Activa" : "Inactiva"}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => setModal(kid)} style={{
                        padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                        cursor: "pointer", color: "#60a5fa",
                        background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
                      }}>✎</button>
                      <button onClick={() => {
                        if (window.confirm(`¿Eliminar "${kid.name}"?`))
                          deleteMutation.mutate(kid.id)
                      }} style={{
                        padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "11px",
                        cursor: "pointer", color: "#f87171",
                        background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
                      }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}