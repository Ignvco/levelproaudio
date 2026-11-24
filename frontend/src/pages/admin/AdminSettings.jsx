// pages/admin/AdminSettings.jsx — LEVELPRO OS V4.0 GATE 12: Visual Editorial Bento CMS (BF-30 & BF-31)
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "../../api/client"
import {
  createCmsDraft,
  getAdminSiteSettings,
  getCmsAssets,
  getCmsBanners,
  getCmsEvents,
  getCmsVersion,
  getCmsVersions,
  previewCmsVersion,
  publishCmsVersion,
  reviewCmsVersion,
  rollbackCmsVersion,
  saveCmsAnnouncement,
  saveCmsBanner,
  saveCmsHeroSlide,
  updateCmsDraft,
  updateSiteSettings,
  uploadCmsAsset,
} from "../../api/siteSettings.api"
import {
  AdminPageHeader,
  ErrorState,
  FormField,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatCard,
  formInputStyle,
} from "../../components/admin/ui"
import { showToast } from "../../utils/toast"

const TABS = [
  { id: "overview", label: "1. Vista General" },
  { id: "hero", label: "2. Editor Hero" },
  { id: "assets", label: "3. Imágenes" },
  { id: "banners", label: "4. Banners" },
  { id: "announcements", label: "5. Anuncios" },
  { id: "sections", label: "6. Secciones Home" },
  { id: "buttons", label: "7. Botones & Enlaces" },
  { id: "seo", label: "8. SEO" },
  { id: "drafts", label: "9. Borradores" },
  { id: "history", label: "10. Historial" },
  { id: "preview", label: "11. Previsualización" },
  { id: "publish", label: "12. Publicar & Rollback" },
  { id: "systemic", label: "Config. Sistémica (FX)" },
]

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", width: "100%", px: 1440 },
  { id: "tablet", label: "Tablet", width: "768px", px: 768 },
  { id: "mobile", label: "Mobile", width: "390px", px: 390 },
  { id: "mobile320", label: "Mobile 320px", width: "320px", px: 320 },
]

const GRID_2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
}

const GRID_3 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
}

const GRID_4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
}

const ROW_BOX = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "14px 16px",
  borderRadius: "14px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
}

const DARK_STATUS_BOX = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "16px 20px",
  borderRadius: "16px",
  background: "#0B0E14",
  border: "1px solid #242A34",
  color: "#F5F5F5",
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("overview")
  const [versions, setVersions] = useState([])
  const [activeDraft, setActiveDraft] = useState(null)
  const [assets, setAssets] = useState([])
  const [banners, setBanners] = useState([])
  const [events, setEvents] = useState([])
  const [previewData, setPreviewData] = useState(null)
  const [previewViewport, setPreviewViewport] = useState("desktop")
  const [previewNonce, setPreviewNonce] = useState(1)
  const [isDirty, setIsDirty] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [busy, setBusy] = useState(false)

  const [draftPayload, setDraftPayload] = useState({
    hero_title: "",
    hero_subtitle: "",
    hero_cta1_text: "",
    hero_cta1_link: "",
    hero_cta2_text: "",
    hero_cta2_link: "",
    site_name: "LevelPro Audio",
    tagline: "",
    seo_title: "",
    seo_description: "",
    show_trust_strip: true,
    show_pillars: true,
    show_products: true,
    show_courses: true,
    show_services: true,
    show_about: true,
    show_trust_details: true,
    show_testimonial: true,
    show_brands: true,
    show_final_cta: true,
  })

  const [slideForm, setSlideForm] = useState({
    order: 1,
    title: "",
    subtitle: "",
    desktop_image_id: "",
    mobile_image_id: "",
    alt_text: "",
    cta1_text: "",
    cta1_link: "/shop",
    overlay_opacity: 40,
  })

  const [bannerForm, setBannerForm] = useState({
    code: "",
    name: "",
    banner_type: "home_mid",
    target_page: "home",
    desktop_image_id: "",
    mobile_image_id: "",
    title: "",
    body_text: "",
    cta_text: "",
    cta_link: "/shop",
  })

  const [annForm, setAnnForm] = useState({
    text: "",
    link_url: "/shop",
    market: "ALL",
    currency: "ALL",
    priority: 10,
  })

  const [assetFile, setAssetFile] = useState(null)
  const [assetTitle, setAssetTitle] = useState("")
  const [assetAlt, setAssetAlt] = useState("")
  const [assetDevice, setAssetDevice] = useState("desktop")

  const [systemForm, setSystemForm] = useState({
    usd_to_clp: "950.00",
    usd_to_ars: "1000.00",
    contact_whatsapp: "",
    contact_email: "",
  })

  const { data: sysSettings, isError: sysError } = useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: getAdminSiteSettings,
    retry: false,
  })

  const { data: rbacMe } = useQuery({
    queryKey: ["admin-rbac-me-cms"],
    queryFn: () => api.get("/admin/rbac/me/").then((r) => r.data).catch(() => null),
    retry: false,
  })

  const canPublish = (() => {
    if (rbacMe) {
      if (rbacMe.is_superuser) return true
      const roles = rbacMe.roles || []
      return roles.includes("Super Admin") || roles.includes("Gerencia / Administración")
    }
    try {
      const raw = sessionStorage.getItem("levelproaudio-auth")
      const parsed = raw ? JSON.parse(raw) : null
      const u = parsed?.state?.user || parsed?.user
      if (!u) return true
      if (u.is_superuser) return true
      const roles = u.roles || []
      if (roles.length === 0) return true
      return roles.includes("Super Admin") || roles.includes("Gerencia / Administración") || roles.includes("super_admin")
    } catch {
      return true
    }
  })()

  useEffect(() => {
    if (sysSettings) {
      setSystemForm({
        usd_to_clp: String(sysSettings.usd_to_clp ?? "950.00"),
        usd_to_ars: String(sysSettings.usd_to_ars ?? "1000.00"),
        contact_whatsapp: sysSettings.contact_whatsapp || "",
        contact_email: sysSettings.contact_email || "",
      })
    }
  }, [sysSettings])

  const loadCms = async (preferredVersionId = null) => {
    setBusy(true)
    setErrorMsg("")
    try {
      const [vRes, aRes, eRes] = await Promise.all([getCmsVersions(), getCmsAssets(), getCmsEvents()])
      const vList = vRes.results || []
      setVersions(vList)
      setAssets(aRes.results || [])
      setEvents(eRes.results || [])

      const targetDraft =
        (preferredVersionId && vList.find((v) => v.id === preferredVersionId)) ||
        vList.find((v) => v.status === "draft" || v.status === "in_review" || v.status === "approved") ||
        vList[0]
      if (targetDraft) {
        const detail = await getCmsVersion(targetDraft.id)
        setActiveDraft(detail)
        setDraftPayload((prev) => ({ ...prev, ...(detail.payload || {}) }))
        setIsDirty(false)
        const bRes = await getCmsBanners(targetDraft.id)
        setBanners(bRes.results || [])
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Error cargando CMS Editorial")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadCms()
  }, [])

  const updatePayloadField = (key, value) => {
    setDraftPayload((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  const handleCreateDraft = async () => {
    setBusy(true)
    setErrorMsg("")
    setFeedback("")
    try {
      const created = await createCmsDraft("Nuevo borrador editorial")
      setActiveDraft(created)
      setDraftPayload((prev) => ({ ...prev, ...(created.payload || {}) }))
      setIsDirty(false)
      setFeedback(`Borrador v${created.version_number} creado correctamente.`)
      await loadCms(created.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "No se pudo crear el borrador")
    } finally {
      setBusy(false)
    }
  }

  const handleSaveDraft = async (e) => {
    if (e) e.preventDefault()
    if (!activeDraft) return
    setBusy(true)
    setErrorMsg("")
    setFeedback("")
    try {
      const updated = await updateCmsDraft(activeDraft.version_id, draftPayload, "Actualización desde editor visual")
      setActiveDraft(updated)
      setIsDirty(false)
      setPreviewNonce((n) => n + 1)
      setFeedback(`Borrador v${updated.version_number} guardado (checksum ${updated.checksum_sha256?.slice(0, 10)}).`)
      showToast?.("Borrador guardado", "success")
      await loadCms(updated.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Error guardando borrador")
    } finally {
      setBusy(false)
    }
  }

  const handleUploadAsset = async (e) => {
    e.preventDefault()
    if (!assetFile) return
    setBusy(true)
    setErrorMsg("")
    try {
      const created = await uploadCmsAsset(assetFile, {
        title: assetTitle || assetFile.name,
        alt_text: assetAlt || assetTitle || assetFile.name,
        device_target: assetDevice,
      })
      setFeedback(`Imagen '${created.title}' (${created.width}x${created.height} ${created.file_format}) validada y cargada.`)
      setAssetFile(null)
      setAssetTitle("")
      setAssetAlt("")
      await loadCms(activeDraft?.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Imagen rechazada por política de seguridad")
    } finally {
      setBusy(false)
    }
  }

  const handleAddSlide = async (e) => {
    e.preventDefault()
    if (!activeDraft) return
    setBusy(true)
    setErrorMsg("")
    try {
      await saveCmsHeroSlide({ ...slideForm, version_id: activeDraft.version_id })
      setFeedback("Slide agregado al borrador.")
      setSlideForm((f) => ({ ...f, title: "", subtitle: "" }))
      setPreviewNonce((n) => n + 1)
      await loadCms(activeDraft.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Error guardando slide")
    } finally {
      setBusy(false)
    }
  }

  const handleAddBanner = async (e) => {
    e.preventDefault()
    if (!activeDraft) return
    setBusy(true)
    setErrorMsg("")
    try {
      await saveCmsBanner({ ...bannerForm, version_id: activeDraft.version_id })
      setFeedback("Banner agregado al borrador.")
      setBannerForm((f) => ({ ...f, code: "", name: "", title: "" }))
      setPreviewNonce((n) => n + 1)
      await loadCms(activeDraft.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Error guardando banner")
    } finally {
      setBusy(false)
    }
  }

  const handleAddAnnouncement = async (e) => {
    e.preventDefault()
    if (!activeDraft) return
    setBusy(true)
    setErrorMsg("")
    try {
      await saveCmsAnnouncement({ ...annForm, version_id: activeDraft.version_id })
      setFeedback("Anuncio agregado al borrador.")
      setAnnForm((f) => ({ ...f, text: "" }))
      setPreviewNonce((n) => n + 1)
      await loadCms(activeDraft.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Error guardando anuncio")
    } finally {
      setBusy(false)
    }
  }

  const handleLoadPreview = async () => {
    if (!activeDraft) return
    setBusy(true)
    setErrorMsg("")
    try {
      const prev = await previewCmsVersion(activeDraft.version_id)
      setPreviewData(prev)
      setPreviewNonce((n) => n + 1)
      setActiveTab("preview")
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "No se pudo cargar la previsualización")
    } finally {
      setBusy(false)
    }
  }

  const handlePublish = async (versionId) => {
    setBusy(true)
    setErrorMsg("")
    setFeedback("")
    try {
      const pub = await publishCmsVersion(versionId, "Publicación desde CMS Gate 12")
      setFeedback(`Versión v${pub.version_number} publicada atómicamente en el sitio público.`)
      setPreviewNonce((n) => n + 1)
      await loadCms(pub.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "No se pudo publicar la versión")
    } finally {
      setBusy(false)
    }
  }

  const handleRollback = async (versionId) => {
    setBusy(true)
    setErrorMsg("")
    setFeedback("")
    try {
      const pub = await rollbackCmsVersion(versionId, "Rollback editorial")
      setFeedback(`Rollback completado: nueva versión publicada v${pub.version_number}.`)
      setPreviewNonce((n) => n + 1)
      await loadCms(pub.version_id)
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Error ejecutando rollback")
    } finally {
      setBusy(false)
    }
  }

  const handleSaveSystemic = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrorMsg("")
    try {
      await updateSiteSettings(systemForm)
      setFeedback("Configuración sistémica (FX / contacto) actualizada con auditoría.")
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || "Sin permisos para modificar configuración sistémica")
    } finally {
      setBusy(false)
    }
  }

  if (sysError && !versions.length && !busy) return <ErrorState message="Error cargando configuración del sitio" />

  const publishedVer = versions.find((v) => v.status === "published")
  const isEditable = activeDraft && ["draft", "in_review"].includes(activeDraft.status)
  const currentVp = VIEWPORTS.find((v) => v.id === previewViewport) || VIEWPORTS[0]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} data-testid="admin-cms-page">
      <AdminPageHeader
        title="Editor Visual CMS & Versionado"
        subtitle="Gate 12 · Editorial Bento (#0B0E14 / #1AFF6E) · Borradores, Previsualización en Vivo, Publicación Atómica y Rollback"
        actions={
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
            <SecondaryButton onClick={handleCreateDraft} disabled={busy}>
              + Nuevo Borrador
            </SecondaryButton>
            {isEditable && (
              <SecondaryButton onClick={handleSaveDraft} disabled={busy}>
                Guardar Borrador
              </SecondaryButton>
            )}
            <SecondaryButton onClick={handleLoadPreview} disabled={busy || !activeDraft}>
              Previsualizar
            </SecondaryButton>
            {activeDraft && isEditable && (
              <PrimaryButton
                onClick={() => handlePublish(activeDraft.version_id)}
                disabled={busy || !canPublish}
                title={!canPublish ? "Requiere rol Gerencia o Super Admin para publicar" : "Publicar versión"}
              >
                Publicar v{activeDraft.version_number}
              </PrimaryButton>
            )}
          </div>
        }
      />

      {/* Barra persistente de estado editorial: Publicado vs Borrador + Advertencia de cambios sin guardar */}
      <div style={GRID_2}>
        <div style={DARK_STATUS_BOX}>
          <div>
            <span style={{
              display: "inline-block", padding: "3px 8px", borderRadius: "6px",
              background: "rgba(26,255,110,0.16)", color: "#1AFF6E",
              fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase",
            }}>
              Publicado en Sitio Público
            </span>
            <p style={{ margin: "6px 0 2px", fontSize: "14px", fontWeight: 700, color: "#F5F5F5" }}>
              {publishedVer ? `Versión v${publishedVer.version_number} · ${publishedVer.change_summary || "Activa"}` : "Base SiteSettings (Sin versión CMS publicada)"}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
              {publishedVer ? `Por: ${publishedVer.published_by_email || "admin"} · ${publishedVer.published_at?.slice(0, 19) || ""}` : "Compatible con configuración original"}
            </p>
          </div>
          {publishedVer && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#1AFF6E" }}>
              SHA: {publishedVer.checksum_sha256?.slice(0, 8)}
            </span>
          )}
        </div>

        <div style={DARK_STATUS_BOX}>
          <div>
            <span style={{
              display: "inline-block", padding: "3px 8px", borderRadius: "6px",
              background: "rgba(245,158,11,0.18)", color: "#FBBF24",
              fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase",
            }}>
              {activeDraft?.status === "published" ? "Versión Seleccionada (Publicada)" : "Borrador en Edición (No Publicado)"}
            </span>
            <p style={{ margin: "6px 0 2px", fontSize: "14px", fontWeight: 700, color: "#F5F5F5" }}>
              {activeDraft ? `Versión v${activeDraft.version_number} [${activeDraft.status.toUpperCase()}]` : "Cree un borrador para editar"}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
              {!canPublish ? "Modo Editor (Marketing): puede guardar y enviar a revisión; publicación reservada a Gerencia." : "Modo Publicador Autorizado: puede guardar, aprobar, publicar y restaurar."}
            </p>
          </div>
          {isDirty && (
            <span
              data-testid="cms-unsaved-warning"
              style={{
                padding: "6px 12px", borderRadius: "8px",
                background: "rgba(245,158,11,0.22)", border: "1px solid #F59E0B",
                color: "#FDE68A", fontSize: "11px", fontWeight: 700,
              }}
            >
              Cambios sin guardar
            </span>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          style={{
            padding: "12px 16px", borderRadius: "12px",
            background: "#0B0E14", border: "1px solid rgba(26,255,110,0.45)",
            color: "#1AFF6E", fontSize: "13px", fontWeight: 600,
          }}
        >
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: "12px 16px", borderRadius: "12px",
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)",
            color: "var(--danger)", fontSize: "13px", fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      <nav
        role="tablist"
        aria-label="Secciones CMS"
        className="au-tabs"
        style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
      >
        {TABS.map((t) => {
          const sel = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setActiveTab(t.id)}
              className={`au-tab ${sel ? "is-active" : ""}`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={GRID_4}>
            <StatCard
              variant="ink"
              label="Versión Pública Vigente"
              value={publishedVer ? `v${publishedVer.version_number}` : "Base"}
              sub={publishedVer?.published_at?.slice(0, 16) || "SiteSettings vigente"}
            />
            <StatCard
              variant="dark"
              label="Versión en Trabajo"
              value={activeDraft ? `v${activeDraft.version_number} (${activeDraft.status})` : "Ninguna"}
              sub={`Slides: ${activeDraft?.hero_slides?.length ?? 0} · Banners: ${banners.length}`}
            />
            <StatCard
              variant="dark"
              label="Assets Validados"
              value={assets.length}
              sub="JPEG · PNG · WEBP · Anti-SVG"
            />
            <StatCard
              variant="dark"
              label="Eventos Auditados"
              value={events.length}
              sub="Checksums SHA-256 inmutables"
            />
          </div>

          <SectionCard
            title="Resumen de Contenido del Borrador Activo"
            description="Estado actual del borrador seleccionado antes de publicar en la tienda pública."
          >
            <div style={GRID_3}>
              <div style={ROW_BOX}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Título Hero (Borrador)</span>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                    {draftPayload.hero_title || "—"}
                  </p>
                </div>
              </div>
              <div style={ROW_BOX}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-3)" }}>CTA Principal</span>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: "var(--accent-text)" }}>
                    {draftPayload.hero_cta1_text || "Explorar tienda"} → {draftPayload.hero_cta1_link || "/shop"}
                  </p>
                </div>
              </div>
              <div style={ROW_BOX}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-3)" }}>SEO Title</span>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                    {draftPayload.seo_title || "—"}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "hero" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <SectionCard
            title={`Textos Hero del Home (Borrador v${activeDraft?.version_number || "—"})`}
            description={isEditable ? "Edite los textos principales del Hero y guarde en el borrador." : "Versión en solo lectura (cree un nuevo borrador para editar)."}
          >
            <form onSubmit={handleSaveDraft} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <FormField label="Título Principal Hero">
                <input
                  value={draftPayload.hero_title || ""}
                  onChange={(e) => updatePayloadField("hero_title", e.target.value)}
                  style={formInputStyle}
                />
              </FormField>
              <FormField label="Subtítulo Hero">
                <textarea
                  rows={2}
                  value={draftPayload.hero_subtitle || ""}
                  onChange={(e) => updatePayloadField("hero_subtitle", e.target.value)}
                  style={formInputStyle}
                />
              </FormField>
              <div>
                <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar en Borrador</PrimaryButton>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Agregar Slide al Hero Slider Responsivo"
            description="Asocie imágenes independientes para Desktop y Mobile con su respectivo CTA."
          >
            <form onSubmit={handleAddSlide} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={GRID_3}>
                <FormField label="Título del Slide">
                  <input placeholder="Título slide" value={slideForm.title} onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })} style={formInputStyle} />
                </FormField>
                <FormField label="Imagen Desktop">
                  <select value={slideForm.desktop_image_id} onChange={(e) => setSlideForm({ ...slideForm, desktop_image_id: e.target.value })} style={formInputStyle}>
                    <option value="">Imagen Desktop (opcional)</option>
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.device_target})</option>)}
                  </select>
                </FormField>
                <FormField label="Imagen Mobile">
                  <select value={slideForm.mobile_image_id} onChange={(e) => setSlideForm({ ...slideForm, mobile_image_id: e.target.value })} style={formInputStyle}>
                    <option value="">Imagen Mobile (opcional)</option>
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.device_target})</option>)}
                  </select>
                </FormField>
                <FormField label="Subtítulo del Slide">
                  <input placeholder="Subtítulo opcional" value={slideForm.subtitle} onChange={(e) => setSlideForm({ ...slideForm, subtitle: e.target.value })} style={formInputStyle} />
                </FormField>
                <FormField label="Texto CTA">
                  <input placeholder="Ej. Ver catálogo" value={slideForm.cta1_text} onChange={(e) => setSlideForm({ ...slideForm, cta1_text: e.target.value })} style={formInputStyle} />
                </FormField>
                <FormField label="URL Destino CTA">
                  <input placeholder="/shop" value={slideForm.cta1_link} onChange={(e) => setSlideForm({ ...slideForm, cta1_link: e.target.value })} style={formInputStyle} />
                </FormField>
              </div>
              <div>
                <SecondaryButton type="submit" disabled={busy || !isEditable}>+ Guardar Slide</SecondaryButton>
              </div>

              {(activeDraft?.hero_slides || []).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--text-2)" }}>
                    Slides en este borrador ({activeDraft.hero_slides.length}):
                  </p>
                  {activeDraft.hero_slides.map((sl) => (
                    <div key={sl.id} style={ROW_BOX}>
                      <span style={{ fontSize: "13px" }}>
                        #{sl.order} · <strong>{sl.title || "Slide sin título"}</strong> · CTA: {sl.cta1_text || "heredado"} ({sl.cta1_link || "/shop"})
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-text)" }}>
                        Desktop: {sl.desktop_image?.title || "Fallback"} · Mobile: {sl.mobile_image?.title || "Fallback"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </SectionCard>
        </div>
      )}

      {activeTab === "assets" && (
        <SectionCard
          title="Gestor Seguro de Imágenes (Desktop / Mobile)"
          description="Validación binaria real con Pillow (JPEG, PNG, WEBP), bloqueo anti-SVG/script y hash SHA-256."
        >
          <form onSubmit={handleUploadAsset} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
            <div style={GRID_4}>
              <FormField label="Título del Asset">
                <input placeholder="Título del asset" value={assetTitle} onChange={(e) => setAssetTitle(e.target.value)} style={formInputStyle} />
              </FormField>
              <FormField label="Texto Alternativo (Alt SEO)">
                <input placeholder="Texto alternativo (Alt SEO)" value={assetAlt} onChange={(e) => setAssetAlt(e.target.value)} style={formInputStyle} />
              </FormField>
              <FormField label="Dispositivo Destino">
                <select value={assetDevice} onChange={(e) => setAssetDevice(e.target.value)} style={formInputStyle}>
                  <option value="desktop">Desktop (Panorámico)</option>
                  <option value="mobile">Mobile (Vertical)</option>
                  <option value="universal">Universal</option>
                </select>
              </FormField>
              <FormField label="Archivo de Imagen">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setAssetFile(e.target.files?.[0] || null)} style={formInputStyle} />
              </FormField>
            </div>
            <div>
              <PrimaryButton type="submit" disabled={busy || !assetFile}>Subir Imagen</PrimaryButton>
            </div>
          </form>
          <div style={GRID_3}>
            {assets.map((a) => (
              <div key={a.id} style={ROW_BOX}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{a.title}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--text-2)" }}>
                    Dispositivo: <strong>{a.device_target}</strong> · {a.width}×{a.height}px · {a.file_format}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                    SHA256: {a.sha256?.slice(0, 16) || "verificado"}
                  </p>
                </div>
                <span className="au-badge au-badge--success">VALIDADO</span>
              </div>
            ))}
            {assets.length === 0 && <p style={{ fontSize: "13px", color: "var(--text-3)" }}>No hay imágenes cargadas todavía.</p>}
          </div>
        </SectionCard>
      )}

      {activeTab === "banners" && (
        <SectionCard
          title="Gestor de Banners (Home & Categorías)"
          description="Configure banners promocionales vinculados al borrador activo."
        >
          <form onSubmit={handleAddBanner} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
            <div style={GRID_3}>
              <FormField label="Código">
                <input required placeholder="Código (ej. BF-HOME-01)" value={bannerForm.code} onChange={(e) => setBannerForm({ ...bannerForm, code: e.target.value })} style={formInputStyle} />
              </FormField>
              <FormField label="Nombre Interno">
                <input required placeholder="Nombre banner" value={bannerForm.name} onChange={(e) => setBannerForm({ ...bannerForm, name: e.target.value })} style={formInputStyle} />
              </FormField>
              <FormField label="Título Visible">
                <input required placeholder="Título visible" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} style={formInputStyle} />
              </FormField>
              <FormField label="Texto CTA">
                <input placeholder="CTA texto" value={bannerForm.cta_text} onChange={(e) => setBannerForm({ ...bannerForm, cta_text: e.target.value })} style={formInputStyle} />
              </FormField>
              <FormField label="Enlace CTA">
                <input placeholder="CTA enlace (/shop)" value={bannerForm.cta_link} onChange={(e) => setBannerForm({ ...bannerForm, cta_link: e.target.value })} style={formInputStyle} />
              </FormField>
              <FormField label="Imagen Desktop">
                <select value={bannerForm.desktop_image_id} onChange={(e) => setBannerForm({ ...bannerForm, desktop_image_id: e.target.value })} style={formInputStyle}>
                  <option value="">Imagen Desktop</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </FormField>
            </div>
            <div>
              <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar Banner en Borrador</PrimaryButton>
            </div>
          </form>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {banners.map((b) => (
              <div key={b.id} style={ROW_BOX}>
                <span style={{ fontSize: "13px" }}>
                  <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-text)" }}>{b.code}</strong> · <strong>{b.title || b.name}</strong> → {b.cta_link}
                </span>
                <span className="au-badge au-badge--neutral">{b.target_page} · {b.status}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "announcements" && (
        <SectionCard
          title="Barra de Anuncios Programable"
          description="Anuncios editoriales sujetos a vigencia horaria y aislamiento respecto del motor de precios."
        >
          <form onSubmit={handleAddAnnouncement} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "18px" }}>
            <div style={GRID_3}>
              <FormField label="Texto del Anuncio">
                <input required placeholder="Texto del anuncio" value={annForm.text} onChange={(e) => setAnnForm({ ...annForm, text: e.target.value })} style={formInputStyle} />
              </FormField>
              <FormField label="Enlace Destino">
                <input placeholder="Enlace (/shop)" value={annForm.link_url} onChange={(e) => setAnnForm({ ...annForm, link_url: e.target.value })} style={formInputStyle} />
              </FormField>
              <FormField label="Moneda Objetivo">
                <select value={annForm.currency} onChange={(e) => setAnnForm({ ...annForm, currency: e.target.value })} style={formInputStyle}>
                  <option value="ALL">Todas las monedas</option>
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </FormField>
            </div>
            <div>
              <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar Anuncio</PrimaryButton>
            </div>
          </form>
          {(activeDraft?.announcements || []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {activeDraft.announcements.map((a) => (
                <div key={a.id} style={ROW_BOX}>
                  <span style={{ fontSize: "13px" }}><strong>{a.text}</strong> ({a.currency}) → {a.link_url}</span>
                  <span className="au-badge au-badge--success">{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "sections" && (
        <SectionCard
          title="Visibilidad de Secciones del Home"
          description="Active o desactive bloques editoriales del Home sin afectar datos maestros de catálogo o cursos."
        >
          <form onSubmit={handleSaveDraft} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={GRID_2}>
              {[
                ["show_trust_strip", "Barra de Confianza"],
                ["show_pillars", "Pilares (Tienda / Academia / Servicios)"],
                ["show_products", "Productos Destacados"],
                ["show_courses", "Cursos Academia"],
                ["show_services", "Servicios Profesionales"],
                ["show_about", "Conoce LevelPro"],
                ["show_testimonial", "Testimonio Destacado"],
                ["show_brands", "Marcas"],
                ["show_final_cta", "CTA Final"],
              ].map(([key, label]) => (
                <label key={key} style={{ ...ROW_BOX, cursor: "pointer" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{label}</span>
                  <input type="checkbox" checked={Boolean(draftPayload[key])} onChange={(e) => updatePayloadField(key, e.target.checked)} />
                </label>
              ))}
            </div>
            <div>
              <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar Secciones</PrimaryButton>
            </div>
          </form>
        </SectionCard>
      )}

      {activeTab === "buttons" && (
        <SectionCard
          title="Botones y Enlaces CTA (Validación Segura Anti-XSS)"
          description="Permite rutas internas relativas (/shop) o HTTPS externas autorizadas."
        >
          <form onSubmit={handleSaveDraft} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={GRID_2}>
              <FormField label="CTA 1 Texto"><input value={draftPayload.hero_cta1_text || ""} onChange={(e) => updatePayloadField("hero_cta1_text", e.target.value)} style={formInputStyle} /></FormField>
              <FormField label="CTA 1 Enlace"><input value={draftPayload.hero_cta1_link || ""} onChange={(e) => updatePayloadField("hero_cta1_link", e.target.value)} style={formInputStyle} /></FormField>
              <FormField label="CTA 2 Texto"><input value={draftPayload.hero_cta2_text || ""} onChange={(e) => updatePayloadField("hero_cta2_text", e.target.value)} style={formInputStyle} /></FormField>
              <FormField label="CTA 2 Enlace"><input value={draftPayload.hero_cta2_link || ""} onChange={(e) => updatePayloadField("hero_cta2_link", e.target.value)} style={formInputStyle} /></FormField>
            </div>
            <div>
              <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar CTA</PrimaryButton>
            </div>
          </form>
        </SectionCard>
      )}

      {activeTab === "seo" && (
        <SectionCard
          title="Metadatos SEO Dinámicos"
          description="Se aplican a head, Open Graph y React SEO únicamente cuando la versión es publicada."
        >
          <form onSubmit={handleSaveDraft} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <FormField label="SEO Title"><input value={draftPayload.seo_title || ""} onChange={(e) => updatePayloadField("seo_title", e.target.value)} style={formInputStyle} /></FormField>
            <FormField label="Meta Description"><textarea rows={2} value={draftPayload.seo_description || ""} onChange={(e) => updatePayloadField("seo_description", e.target.value)} style={formInputStyle} /></FormField>
            <div>
              <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar SEO en Borrador</PrimaryButton>
            </div>
          </form>
        </SectionCard>
      )}

      {activeTab === "drafts" && (
        <SectionCard
          title="Borradores y Flujo de Revisión Editorial"
          description="Ciclo formal Draft → In Review → Approved → Published → Superseded."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {versions.map((v) => (
              <div key={v.id} data-version-row={v.version_number} style={ROW_BOX}>
                <div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-text)" }}>v{v.version_number}</span> · <strong>{v.status.toUpperCase()}</strong> · {v.change_summary}
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-3)" }}>
                    Autor: {v.created_by_email || "admin"} · Checksum: {v.checksum_sha256?.slice(0, 12)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {v.status === "draft" && (
                    <SecondaryButton onClick={() => reviewCmsVersion(v.id, "in_review").then(() => loadCms(v.id))}>Enviar a Revisión</SecondaryButton>
                  )}
                  {v.status === "in_review" && canPublish && (
                    <SecondaryButton onClick={() => reviewCmsVersion(v.id, "approved").then(() => loadCms(v.id))}>Aprobar</SecondaryButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "history" && (
        <SectionCard
          title="Historial Auditable de Publicaciones"
          description="Registro inmutable de eventos editoriales y hashes SHA-256."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {events.map((ev) => (
              <div key={ev.id} style={ROW_BOX}>
                <span style={{ fontSize: "13px" }}>
                  <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-text)" }}>v{ev.version_number}</strong> · <strong>{ev.event_type}</strong> · {ev.actor_email || "sistema"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)" }}>
                  {ev.checksum_sha256?.slice(0, 12)} · {ev.occurred_at?.slice(0, 19)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "preview" && (
        <SectionCard
          title={`Previsualización en Vivo Fiel al Home Público (${activeDraft ? `Borrador v${activeDraft.version_number}` : "Actual"})`}
          description="Renderizado en documento aislado con tokens públicos reales (#0B0E14, #F5F5F5, #1AFF6E) y media queries nativas del viewport."
          action={
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {VIEWPORTS.map((vp) => {
                const active = previewViewport === vp.id
                return (
                  <button
                    key={vp.id}
                    type="button"
                    onClick={() => setPreviewViewport(vp.id)}
                    className={`au-tab ${active ? "is-active" : ""}`}
                  >
                    {vp.label}
                  </button>
                )
              })}
            </div>
          }
        >
          {!activeDraft ? (
            <SecondaryButton onClick={handleLoadPreview}>Cargar Previsualización</SecondaryButton>
          ) : (
            <div
              data-testid="cms-live-preview-frame"
              style={{
                width: currentVp.width,
                maxWidth: "100%",
                margin: "0 auto",
                border: "2px solid #1AFF6E",
                borderRadius: "16px",
                overflow: "hidden",
                background: "#0B0E14",
                boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
              }}
            >
              <iframe
                key={`${activeDraft.version_id}-${previewViewport}-${previewNonce}`}
                data-testid="cms-live-preview-iframe"
                title="Previsualización en Vivo del Home"
                src={`/?cms_preview_version=${activeDraft.version_id}&vp=${previewViewport}&n=${previewNonce}`}
                style={{
                  width: "100%",
                  height: "860px",
                  border: "none",
                  display: "block",
                  background: "#0B0E14",
                }}
              />
            </div>
          )}
          {previewData && (
            <p style={{ margin: "12px 0 0", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
              Preview cargada · v{previewData.version_number} · Estado: {previewData.status} · No indexable (X-Robots-Tag: noindex, nofollow)
            </p>
          )}
        </SectionCard>
      )}

      {activeTab === "publish" && (
        <SectionCard
          title="Publicación en Un Clic & Rollback Editorial"
          description="Publicación atómica con bloqueo transaccional y restauración no destructiva de versiones anteriores."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {versions.map((v) => (
              <div key={v.id} data-version-row={v.version_number} style={ROW_BOX}>
                <div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "14px" }}>v{v.version_number}</span> ·{" "}
                  <strong style={{ color: "var(--accent-text)" }}>{v.status}</strong> · {v.change_summary}
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-3)" }}>
                    {v.published_at ? `Publicado: ${v.published_at.slice(0, 19)} por ${v.published_by_email || "admin"}` : `Creado: ${v.created_at?.slice(0, 19)}`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["draft", "in_review", "approved"].includes(v.status) && (
                    <PrimaryButton onClick={() => handlePublish(v.id)} disabled={busy || !canPublish}>
                      Publicar versión
                    </PrimaryButton>
                  )}
                  {["published", "superseded"].includes(v.status) && (
                    <SecondaryButton onClick={() => handleRollback(v.id)} disabled={busy || !canPublish}>
                      Restaurar (Rollback)
                    </SecondaryButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "systemic" && (
        <SectionCard
          title="Configuración Sistémica Protegida (Aislada del CMS Editorial)"
          description="Tasas de cambio y contactos operativos reservados a Gerencia / Super Admin (PERM_MANAGE_SETTINGS)."
        >
          <form onSubmit={handleSaveSystemic} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={GRID_2}>
              <FormField label="1 USD = ? CLP"><input value={systemForm.usd_to_clp} onChange={(e) => setSystemForm({ ...systemForm, usd_to_clp: e.target.value })} style={formInputStyle} /></FormField>
              <FormField label="1 USD = ? ARS"><input value={systemForm.usd_to_ars} onChange={(e) => setSystemForm({ ...systemForm, usd_to_ars: e.target.value })} style={formInputStyle} /></FormField>
              <FormField label="WhatsApp Operativo"><input value={systemForm.contact_whatsapp} onChange={(e) => setSystemForm({ ...systemForm, contact_whatsapp: e.target.value })} style={formInputStyle} /></FormField>
              <FormField label="Email Operativo"><input value={systemForm.contact_email} onChange={(e) => setSystemForm({ ...systemForm, contact_email: e.target.value })} style={formInputStyle} /></FormField>
            </div>
            <div>
              <PrimaryButton type="submit" disabled={busy || !canPublish}>Guardar Configuración Sistémica</PrimaryButton>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  )
}
