// pages/admin/AdminBrands.jsx
import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminBrands, createAdminBrand, updateAdminBrand, deleteAdminBrand } from "../../api/admin.api"
import { mediaUrl } from "../../utils/mediaUrl"

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
}

function BrandModal({ brand, onClose, onSave }) {
  const [form, setForm]   = useState({ name: brand?.name || "", website: brand?.website || "" })
  const [logo, setLogo]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const fileRef             = useRef(null)

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return }
    setSaving(true); setError("")
    try {
      const fd = new FormData()
      fd.append("name", form.name)
      if (form.website) fd.append("website", form.website)
      if (logo) fd.append("logo", logo)
      if (brand?.id) await updateAdminBrand(brand.id, fd)
      else await createAdminBrand(fd)
      onSave(); onClose()
    } catch (e) {
      setError(e?.response?.data?.name?.[0] || "Error al guardar.")
    } finally { setSaving(false) }
  }

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
            {brand?.id ? "Editar marca" : "Nueva marca"}
          </p>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "22px" }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Nombre *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={inputSt} placeholder="Nombre de la marca"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Sitio web</label>
            <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
              style={inputSt} placeholder="https://..."
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "7px" }}>Logo</label>
            <input ref={fileRef} type="file" accept="image/*"
              onChange={e => setLogo(e.target.files?.[0])}
              style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{
              width: "100%", padding: "14px", borderRadius: "var(--r-lg)",
              background: "var(--surface-2)", border: "2px dashed var(--border)",
              color: "var(--text-3)", fontSize: "13px", cursor: "pointer",
            }}>
              {logo ? `✓ ${logo.name}` : "Seleccionar imagen"}
            </button>
            {brand?.logo && !logo && (
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <img src={mediaUrl(brand.logo)} alt={brand.name}
                  style={{ height: "28px", objectFit: "contain",
                    filter: "brightness(0) invert(1)", opacity: 0.6 }} />
                <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Logo actual</span>
              </div>
            )}
          </div>
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

export default function AdminBrands() {
  const [modal, setModal]   = useState(null)
  const queryClient         = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-brands"], queryFn: getAdminBrands,
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminBrand,
    onSuccess:  () => queryClient.invalidateQueries(["admin-brands"]),
  })
  const brands = data?.results || data || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {modal && (
        <BrandModal
          brand={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries(["admin-brands"])}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
            letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Marcas
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {brands.length} marcas registradas
          </p>
        </div>
        <button onClick={() => setModal("new")} className="btn btn-accent"
          style={{ padding: "10px 20px", fontSize: "13px" }}>
          + Nueva marca
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "100px" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
          {brands.map(brand => (
            <div key={brand.id} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)", padding: "20px",
              display: "flex", flexDirection: "column", gap: "14px",
              transition: "all var(--dur-slow) var(--ease)",
            }}
              className="card card-glow"
            >
              {/* Logo */}
              <div style={{ height: "40px", display: "flex",
                alignItems: "center", justifyContent: "center" }}>
                {brand.logo ? (
                  <img src={mediaUrl(brand.logo)} alt={brand.name}
                    style={{ maxHeight: "36px", maxWidth: "140px",
                      objectFit: "contain", filter: "brightness(0) invert(0.7)" }} />
                ) : (
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "var(--r-md)",
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", color: "var(--text-3)",
                  }}>
                    🏷
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize: "14px", fontWeight: 500,
                  textAlign: "center", marginBottom: "4px" }}>
                  {brand.name}
                </p>
                {brand.website && (
                  <p style={{ fontSize: "11px", color: "var(--text-3)",
                    textAlign: "center", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {brand.website}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setModal(brand)} style={{
                  flex: 1, padding: "7px", borderRadius: "var(--r-md)",
                  fontSize: "12px", cursor: "pointer",
                  color: "#60a5fa", background: "rgba(96,165,250,0.1)",
                  border: "1px solid rgba(96,165,250,0.2)",
                }}>
                  ✎ Editar
                </button>
                <button onClick={() => {
                  if (window.confirm(`¿Eliminar "${brand.name}"?`))
                    deleteMutation.mutate(brand.id)
                }} style={{
                  flex: 1, padding: "7px", borderRadius: "var(--r-md)",
                  fontSize: "12px", cursor: "pointer",
                  color: "#f87171", background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.2)",
                }}>
                  × Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}