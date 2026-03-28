// pages/admin/AdminCategories.jsx

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import api from "../../api/client"

export default function AdminCategories() {
  const [modal, setModal]   = useState(null)
  const queryClient         = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn:  () => api.get("/categories/").then(r => r.data),
  })

  const categories = data?.results || data || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal !== null && (
        <CategoryModal
          category={modal}
          onClose={() => setModal(null)}
          onSave={() => {
            queryClient.invalidateQueries(["admin-categories"])
            setModal(null)
          }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
            Categorías
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {categories.length} categorías
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nueva categoría
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "52px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 80px",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Nombre</span>
            <span>Slug</span>
            <span>Padre</span>
            <span></span>
          </div>
          {categories.map((cat, i) => (
            <div key={cat.id} style={{
              display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 80px",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <span style={{ fontSize: "13px" }}>{cat.name}</span>
              <span style={{ fontSize: "12px", color: "var(--text-3)",
                fontFamily: "monospace" }}>{cat.slug}</span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {cat.parent ? "Sub" : "Raíz"}
              </span>
              <button onClick={() => setModal(cat)}
                style={{ fontSize: "12px", color: "var(--text-2)", background: "none",
                  border: "none", cursor: "pointer", transition: "color var(--dur)" }}
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

function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState({
    name:        category?.name || "",
    description: category?.description || "",
    is_active:   category?.is_active ?? true,
    order:       category?.order ?? 0,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (category?.id) {
        await api.patch(`/categories/${category.slug}/`, form)
      } else {
        await api.post("/categories/", form)
      }
      onSave()
    } catch { }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "100%", maxWidth: "440px" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {category?.id ? "Editar categoría" : "Nueva categoría"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "20px" }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {[
            { key: "name",        label: "Nombre *",     type: "text" },
            { key: "description", label: "Descripción",  type: "text" },
            { key: "order",       label: "Orden",        type: "number" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px" }}>{label}</label>
              <input type={type} value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="input" />
            </div>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: "8px",
            cursor: "pointer", fontSize: "13px" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              style={{ accentColor: "var(--accent)" }} />
            Activa
          </label>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}