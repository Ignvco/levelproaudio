// pages/admin/AdminBrands.jsx
import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminBrands, createAdminBrand, updateAdminBrand, deleteAdminBrand } from "../../api/admin.api"
import { Tag, ArrowUpRight, CheckCircle2, Globe } from "lucide-react"
import { mediaUrl } from "../../utils/mediaUrl"
import BulkImportPanel from "../../components/admin/BulkImportPanel"
import { AdminPageHeader, PrimaryButton, StatCard, FormModal, FormField, formInputStyle, ConfirmationModal, ErrorState, SecondaryButton, EmptyState } from "../../components/admin/ui"
import { showToast } from "../../utils/toast"

function BrandModal({ brand, onClose, onSave }) {
  const [form, setForm]     = useState({
    name: brand?.name || "",
    website: brand?.website || "",
    is_active: brand?.id ? !!brand.is_active : true,
  })
  const [logo, setLogo]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const fileRef              = useRef(null)

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return }
    setSaving(true); setError("")
    try {
      const fd = new FormData()
      fd.append("name", form.name)
      if (form.website) fd.append("website", form.website)
      fd.append("is_active", form.is_active ? "true" : "false")
      if (logo) fd.append("logo", logo)
      if (brand?.id) await updateAdminBrand(brand.id, fd)
      else await createAdminBrand(fd)
      onSave(); onClose()
    } catch (e) {
      setError(e?.response?.data?.name?.[0] || "Error al guardar.")
    } finally { setSaving(false) }
  }

  return (
    <FormModal
      open
      title={brand?.id ? "Editar marca" : "Nueva marca"}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      error={error}
      testId="brand-modal"
    >
      <FormField label="Nombre *">
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          style={formInputStyle} placeholder="Nombre de la marca" />
      </FormField>

      <FormField label="Sitio web">
        <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
          style={formInputStyle} placeholder="https://..." />
      </FormField>

      <FormField label="Logo">
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
        {brand?.logo_url && !logo && (
          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <img src={mediaUrl(brand.logo_url)} alt={brand.name}
              style={{ height: "32px", objectFit: "contain" }} />
            <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Logo actual</span>
          </div>
        )}
      </FormField>

      <label style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderRadius: "var(--r-md)",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        cursor: "pointer",
      }}>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>Marca activa</p>
          <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>
            Si está apagada, no aparece en el home ni en la tienda pública.
          </p>
        </div>
        <span style={{
          position: "relative", width: "38px", height: "22px",
          borderRadius: "11px", flexShrink: 0,
          background: form.is_active ? "var(--accent)" : "var(--surface-3)",
          transition: "background 200ms",
        }}>
          <input
            data-testid="brand-active-toggle"
            type="checkbox" checked={form.is_active}
            onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            style={{ position: "absolute", opacity: 0, width: "100%",
              height: "100%", cursor: "pointer" }} />
          <span style={{
            position: "absolute", top: "2px",
            left: form.is_active ? "18px" : "2px",
            width: "18px", height: "18px", borderRadius: "50%",
            background: "#fff", transition: "left 200ms var(--ease)",
          }} />
        </span>
      </label>
    </FormModal>
  )
}

export default function AdminBrands() {
  const [modal, setModal]         = useState(null)
  const [toDelete, setToDelete]   = useState(null)
  const queryClient               = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-brands"], queryFn: getAdminBrands,
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminBrand,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ["admin-brands"] }); setToDelete(null) },
    onError:    (e) => {
      showToast(e?.response?.data?.detail || "No se pudo eliminar la marca. Puede tener productos asociados.", "error")
      setToDelete(null)
    },
  })
  const brands = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
  const activeCount = brands.filter(b => b.is_active !== false).length
  const withWebCount = brands.filter(b => !!b.website).length

  return (
    <div className="au-page">
      {modal && (
        <BrandModal
          brand={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => queryClient.invalidateQueries({ queryKey: ["admin-brands"] })}
        />
      )}

      <ConfirmationModal
        open={!!toDelete}
        title="¿Eliminar marca?"
        description={toDelete ? `Se eliminará "${toDelete.name}" permanentemente.` : ""}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
        testId="delete-brand-modal"
      />

      <AdminPageHeader
        eyebrow="LEVELPRO / CATÁLOGO"
        title="Marcas"
        description={isLoading || isError ? "Gestiona los fabricantes del catálogo" : `${brands.length} marcas cargadas en el catálogo`}
        actions={
          <PrimaryButton onClick={() => setModal("new")}>
            + Nueva marca
          </PrimaryButton>
        }
      />

      {!isLoading && !isError && <div className="lp-kpi-strip">
        <StatCard
          variant="ink"
          Icon={Tag}
          label="Total marcas"
          value={brands.length}
          sub="Registradas en catálogo"
        />
        <StatCard
          variant="primary"
          Icon={CheckCircle2}
          label="Marcas activas"
          value={activeCount}
          sub="Visibles en tienda"
        />
        <StatCard
          variant="light"
          Icon={Globe}
          label="Con sitio web"
          value={withWebCount}
          sub="Enlace oficial configurado"
        />
      </div>}

      <BulkImportPanel
        endpoint="/admin/brands/import/"
        entityLabel="marcas"
        templateColumns={["nombre", "sitio_web", "activo"]}
        templateExample={["Neumann", "https://www.neumann.com", "si"]}
        invalidateKey="admin-brands"
        testId="bulk-import-brands"
      />

      {isError ? (
        <ErrorState title="No pudimos cargar las marcas"
          description="Las marcas existentes permanecen guardadas. Intenta actualizar."
          action={<SecondaryButton onClick={() => refetch()}>Reintentar</SecondaryButton>} />
      ) : isLoading ? (
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "140px", borderRadius: "18px" }} />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <EmptyState title="Aún no hay marcas" description="Agrega la primera marca para comenzar." />
      ) : (
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
          {brands.map(brand => (
            <div key={brand.id} className="au-pcard">
              <div className="au-pcard__head">
                <div className="au-pcard__brand">
                  {brand.logo_url
                    ? <img src={mediaUrl(brand.logo_url)} alt={brand.name} />
                    : <Tag size={22} strokeWidth={2} />}
                </div>
                <button type="button" aria-label={`Eliminar marca ${brand.name}`} className="au-pcard__del" data-testid={`btn-delete-brand-${brand.id}`}
                  title="Eliminar" onClick={() => setToDelete(brand)}>
                  ×
                </button>
              </div>
              <h3 className="au-pcard__title">{brand.name}</h3>
              <p className="au-pcard__sub">{brand.website || "Marca del catálogo"}</p>
              <div className="au-pcard__buyrow">
                <span className="au-pcard__pill">{brand.is_active === false ? "Inactiva" : "Activa"}</span>
                <button type="button" aria-label={`Editar marca ${brand.name}`} className="au-pcard__buy" onClick={() => setModal(brand)} data-testid={`btn-edit-brand-${brand.id}`}>
                  Editar <span className="au-pcard__circle"><ArrowUpRight size={15} strokeWidth={2.5} /></span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
