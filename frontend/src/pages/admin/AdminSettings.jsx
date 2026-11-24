// pages/admin/AdminSettings.jsx — LEVELPRO OS V4.0 GATE 12: Visual Editorial Bento CMS (BF-30 & BF-31)
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { AdminPageHeader, ErrorState, FormField, PrimaryButton, SecondaryButton } from "../../components/admin/ui"
import Home from "../Home"
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

const INPUT_CLS =
  "w-full rounded-lg border border-neutral-700 bg-[#0B0E14] px-3 py-2 text-xs text-[#F5F5F5] placeholder-neutral-500 focus:border-[#1AFF6E] focus:outline-none"

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("overview")
  const [versions, setVersions] = useState([])
  const [activeDraft, setActiveDraft] = useState(null)
  const [assets, setAssets] = useState([])
  const [banners, setBanners] = useState([])
  const [events, setEvents] = useState([])
  const [previewData, setPreviewData] = useState(null)
  const [previewViewport, setPreviewViewport] = useState("desktop")
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
  })

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

  const loadCms = async () => {
    setBusy(true)
    setErrorMsg("")
    try {
      const [vRes, aRes, eRes] = await Promise.all([getCmsVersions(), getCmsAssets(), getCmsEvents()])
      const vList = vRes.results || []
      setVersions(vList)
      setAssets(aRes.results || [])
      setEvents(eRes.results || [])

      const targetDraft = vList.find((v) => v.status === "draft" || v.status === "in_review" || v.status === "approved") || vList[0]
      if (targetDraft) {
        const detail = await getCmsVersion(targetDraft.id)
        setActiveDraft(detail)
        setDraftPayload((prev) => ({ ...prev, ...(detail.payload || {}) }))
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

  const handleCreateDraft = async () => {
    setBusy(true)
    setErrorMsg("")
    setFeedback("")
    try {
      const created = await createCmsDraft("Nuevo borrador editorial")
      setActiveDraft(created)
      setDraftPayload((prev) => ({ ...prev, ...(created.payload || {}) }))
      setFeedback(`Borrador v${created.version_number} creado correctamente.`)
      await loadCms()
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
      setFeedback(`Borrador v${updated.version_number} guardado (checksum ${updated.checksum_sha256?.slice(0, 10)}).`)
      showToast?.("Borrador guardado", "success")
      await loadCms()
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
      const created = await uploadCmsAsset(assetFile, { title: assetTitle || assetFile.name, device_target: assetDevice })
      setFeedback(`Imagen '${created.title}' (${created.width}x${created.height} ${created.file_format}) validada y cargada.`)
      setAssetFile(null)
      setAssetTitle("")
      await loadCms()
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
      await loadCms()
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
      await loadCms()
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
      await loadCms()
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Error guardando anuncio")
    } finally {
      setBusy(false)
    }
  }

  const handleLoadPreview = async () => {
    if (!activeDraft) return
    setBusy(true)
    try {
      const prev = await previewCmsVersion(activeDraft.version_id)
      setPreviewData({
        ...(sysSettings || {}),
        ...(prev.payload || {}),
        cms: {
          version_number: prev.version_number,
          hero_slides: prev.hero_slides || [],
          banners: prev.banners || [],
          announcements: prev.announcements || [],
        },
      })
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
      await loadCms()
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
      await loadCms()
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

  if (sysError) return <ErrorState message="Error cargando configuración del sitio" />

  const publishedVer = versions.find((v) => v.status === "published")
  const isEditable = activeDraft && ["draft", "in_review"].includes(activeDraft.status)

  return (
    <div className="space-y-6 text-[#F5F5F5]" data-testid="admin-cms-page">
      <AdminPageHeader
        title="Editor Visual CMS & Versionado"
        subtitle="Gate 12 · Editorial Bento (#0B0E14 / #1AFF6E) · Borradores, Previsualización en Vivo, Publicación Atómica y Rollback"
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={handleCreateDraft} disabled={busy}>
              + Nuevo Borrador
            </SecondaryButton>
            <SecondaryButton onClick={handleLoadPreview} disabled={busy || !activeDraft}>
              Previsualizar
            </SecondaryButton>
            {activeDraft && isEditable && (
              <PrimaryButton onClick={() => handlePublish(activeDraft.version_id)} disabled={busy}>
                Publicar v{activeDraft.version_number}
              </PrimaryButton>
            )}
          </div>
        }
      />

      {feedback && (
        <div role="status" className="rounded-xl border border-[#1AFF6E]/40 bg-[#0B0E14] px-4 py-3 text-xs text-[#1AFF6E]">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      <nav role="tablist" aria-label="Secciones CMS" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const sel = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sel
                  ? "bg-[#1AFF6E] text-[#0B0E14] font-bold"
                  : "border border-neutral-800 bg-[#242A34]/70 text-neutral-300 hover:bg-[#242A34]"
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5">
            <p className="text-[11px] uppercase tracking-wider text-neutral-400">Versión Pública Vigente</p>
            <p className="mt-1 text-2xl font-bold text-[#1AFF6E]">
              {publishedVer ? `v${publishedVer.version_number}` : "Legacy SiteSettings"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">{publishedVer?.published_at || "Sin publicación CMS aún"}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5">
            <p className="text-[11px] uppercase tracking-wider text-neutral-400">Borrador Activo</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {activeDraft ? `v${activeDraft.version_number} (${activeDraft.status})` : "Ninguno"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Slides: {activeDraft?.hero_slides?.length ?? 0} · Banners: {banners.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5">
            <p className="text-[11px] uppercase tracking-wider text-neutral-400">Assets Validados</p>
            <p className="mt-1 text-2xl font-bold text-white">{assets.length}</p>
            <p className="mt-1 text-xs text-neutral-400">Anti-SVG · Dimensiones · SHA-256</p>
          </div>
        </div>
      )}

      {activeTab === "hero" && (
        <div className="space-y-4">
          <form onSubmit={handleSaveDraft} className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Textos Hero del Home (Borrador)</h2>
            <FormField label="Título Principal Hero">
              <input value={draftPayload.hero_title || ""} onChange={(e) => setDraftPayload({ ...draftPayload, hero_title: e.target.value })} className={INPUT_CLS} />
            </FormField>
            <FormField label="Subtítulo Hero">
              <textarea rows={2} value={draftPayload.hero_subtitle || ""} onChange={(e) => setDraftPayload({ ...draftPayload, hero_subtitle: e.target.value })} className={INPUT_CLS} />
            </FormField>
            <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar en Borrador</PrimaryButton>
          </form>

          <form onSubmit={handleAddSlide} className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Agregar Slide al Hero Slider</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input placeholder="Título slide" value={slideForm.title} onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })} className={INPUT_CLS} />
              <select value={slideForm.desktop_image_id} onChange={(e) => setSlideForm({ ...slideForm, desktop_image_id: e.target.value })} className={INPUT_CLS}>
                <option value="">Imagen Desktop (opcional)</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.device_target})</option>)}
              </select>
              <select value={slideForm.mobile_image_id} onChange={(e) => setSlideForm({ ...slideForm, mobile_image_id: e.target.value })} className={INPUT_CLS}>
                <option value="">Imagen Mobile (opcional)</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.device_target})</option>)}
              </select>
            </div>
            <SecondaryButton type="submit" disabled={busy || !isEditable}>+ Guardar Slide</SecondaryButton>
          </form>
        </div>
      )}

      {activeTab === "assets" && (
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-[#0B0E14] p-5">
          <h2 className="text-sm font-semibold text-white">Gestor Seguro de Imágenes (Desktop / Mobile)</h2>
          <form onSubmit={handleUploadAsset} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input placeholder="Título del asset" value={assetTitle} onChange={(e) => setAssetTitle(e.target.value)} className={INPUT_CLS} />
            <select value={assetDevice} onChange={(e) => setAssetDevice(e.target.value)} className={INPUT_CLS}>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="universal">Universal</option>
            </select>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setAssetFile(e.target.files?.[0] || null)} className={INPUT_CLS} />
            <PrimaryButton type="submit" disabled={busy || !assetFile}>Subir Imagen</PrimaryButton>
          </form>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {assets.map((a) => (
              <div key={a.id} className="rounded-lg border border-neutral-800 bg-[#242A34]/40 p-3 text-xs">
                <p className="font-semibold text-white">{a.title}</p>
                <p className="text-neutral-400">{a.device_target} · {a.width}×{a.height} · {a.file_format}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "banners" && (
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-[#0B0E14] p-5">
          <h2 className="text-sm font-semibold text-white">Gestor de Banners (Home & Categorías)</h2>
          <form onSubmit={handleAddBanner} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input required placeholder="Código (ej. BF-HOME-01)" value={bannerForm.code} onChange={(e) => setBannerForm({ ...bannerForm, code: e.target.value })} className={INPUT_CLS} />
            <input required placeholder="Nombre banner" value={bannerForm.name} onChange={(e) => setBannerForm({ ...bannerForm, name: e.target.value })} className={INPUT_CLS} />
            <input required placeholder="Título visible" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} className={INPUT_CLS} />
            <input placeholder="CTA texto" value={bannerForm.cta_text} onChange={(e) => setBannerForm({ ...bannerForm, cta_text: e.target.value })} className={INPUT_CLS} />
            <input placeholder="CTA enlace (/shop)" value={bannerForm.cta_link} onChange={(e) => setBannerForm({ ...bannerForm, cta_link: e.target.value })} className={INPUT_CLS} />
            <select value={bannerForm.desktop_image_id} onChange={(e) => setBannerForm({ ...bannerForm, desktop_image_id: e.target.value })} className={INPUT_CLS}>
              <option value="">Imagen Desktop</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <div className="md:col-span-3">
              <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar Banner en Borrador</PrimaryButton>
            </div>
          </form>
          <div className="space-y-2 text-xs">
            {banners.map((b) => (
              <div key={b.id} className="rounded-lg border border-neutral-800 bg-[#242A34]/40 p-3">
                <span className="font-mono text-[#1AFF6E]">{b.code}</span> · {b.title || b.name} → {b.cta_link}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "announcements" && (
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-[#0B0E14] p-5">
          <h2 className="text-sm font-semibold text-white">Barra de Anuncios Programable</h2>
          <form onSubmit={handleAddAnnouncement} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input required placeholder="Texto del anuncio" value={annForm.text} onChange={(e) => setAnnForm({ ...annForm, text: e.target.value })} className={INPUT_CLS} />
            <input placeholder="Enlace (/shop)" value={annForm.link_url} onChange={(e) => setAnnForm({ ...annForm, link_url: e.target.value })} className={INPUT_CLS} />
            <select value={annForm.currency} onChange={(e) => setAnnForm({ ...annForm, currency: e.target.value })} className={INPUT_CLS}>
              <option value="ALL">Todas las monedas</option>
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
            <div className="md:col-span-3">
              <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar Anuncio</PrimaryButton>
            </div>
          </form>
        </div>
      )}

      {activeTab === "sections" && (
        <form onSubmit={handleSaveDraft} className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Visibilidad de Secciones del Home</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              <label key={key} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-[#242A34]/40 px-3.5 py-2.5 text-xs">
                <span>{label}</span>
                <input type="checkbox" checked={Boolean(draftPayload[key])} onChange={(e) => setDraftPayload({ ...draftPayload, [key]: e.target.checked })} />
              </label>
            ))}
          </div>
          <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar Secciones</PrimaryButton>
        </form>
      )}

      {activeTab === "buttons" && (
        <form onSubmit={handleSaveDraft} className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Botones y Enlaces CTA (Validación Segura)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="CTA 1 Texto"><input value={draftPayload.hero_cta1_text || ""} onChange={(e) => setDraftPayload({ ...draftPayload, hero_cta1_text: e.target.value })} className={INPUT_CLS} /></FormField>
            <FormField label="CTA 1 Enlace"><input value={draftPayload.hero_cta1_link || ""} onChange={(e) => setDraftPayload({ ...draftPayload, hero_cta1_link: e.target.value })} className={INPUT_CLS} /></FormField>
            <FormField label="CTA 2 Texto"><input value={draftPayload.hero_cta2_text || ""} onChange={(e) => setDraftPayload({ ...draftPayload, hero_cta2_text: e.target.value })} className={INPUT_CLS} /></FormField>
            <FormField label="CTA 2 Enlace"><input value={draftPayload.hero_cta2_link || ""} onChange={(e) => setDraftPayload({ ...draftPayload, hero_cta2_link: e.target.value })} className={INPUT_CLS} /></FormField>
          </div>
          <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar CTA</PrimaryButton>
        </form>
      )}

      {activeTab === "seo" && (
        <form onSubmit={handleSaveDraft} className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Metadatos SEO Dinámicos (Solo activos tras publicación)</h2>
          <FormField label="SEO Title"><input value={draftPayload.seo_title || ""} onChange={(e) => setDraftPayload({ ...draftPayload, seo_title: e.target.value })} className={INPUT_CLS} /></FormField>
          <FormField label="Meta Description"><textarea rows={2} value={draftPayload.seo_description || ""} onChange={(e) => setDraftPayload({ ...draftPayload, seo_description: e.target.value })} className={INPUT_CLS} /></FormField>
          <PrimaryButton type="submit" disabled={busy || !isEditable}>Guardar SEO en Borrador</PrimaryButton>
        </form>
      )}

      {activeTab === "drafts" && (
        <div className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-white">Borradores y Flujo de Revisión</h2>
          {versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-[#242A34]/40 p-3">
              <div>
                <span className="font-mono font-bold text-[#1AFF6E]">v{v.version_number}</span> · {v.status} · {v.change_summary}
              </div>
              <div className="flex gap-2">
                {v.status === "draft" && (
                  <SecondaryButton onClick={() => reviewCmsVersion(v.id, "in_review").then(loadCms)}>Enviar a Revisión</SecondaryButton>
                )}
                {v.status === "in_review" && (
                  <SecondaryButton onClick={() => reviewCmsVersion(v.id, "approved").then(loadCms)}>Aprobar</SecondaryButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-white">Historial Auditable de Publicaciones</h2>
          {events.map((ev) => (
            <div key={ev.id} className="rounded-lg border border-neutral-800 bg-[#242A34]/40 p-3">
              <span className="font-mono text-[#1AFF6E]">v{ev.version_number}</span> · {ev.event_type} · {ev.actor_email || "sistema"} · {ev.checksum_sha256?.slice(0, 12)}
            </div>
          ))}
        </div>
      )}

      {activeTab === "preview" && (
        <div className="space-y-3 rounded-xl border border-neutral-800 bg-[#0B0E14] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Previsualización en Vivo del Home Real (Sin publicar borrador)</h2>
            <div className="flex gap-2">
              {[["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"]].map(([vp, lbl]) => (
                <button
                  key={vp}
                  type="button"
                  onClick={() => setPreviewViewport(vp)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${previewViewport === vp ? "bg-[#1AFF6E] text-[#0B0E14]" : "bg-[#242A34] text-neutral-300"}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {!previewData ? (
            <SecondaryButton onClick={handleLoadPreview}>Cargar Previsualización</SecondaryButton>
          ) : (
            <div
              data-testid="cms-live-preview-frame"
              style={{
                width: previewViewport === "mobile" ? "390px" : previewViewport === "tablet" ? "768px" : "100%",
                maxWidth: "100%",
                margin: "0 auto",
                border: "1px solid #1AFF6E",
                borderRadius: "12px",
                overflow: "hidden",
                maxHeight: "720px",
                overflowY: "auto",
              }}
            >
              <Home previewSettings={previewData} />
            </div>
          )}
        </div>
      )}

      {activeTab === "publish" && (
        <div className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-white">Publicación en Un Clic & Rollback Editorial</h2>
          {versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-[#242A34]/40 p-3">
              <div>
                <span className="font-mono font-bold text-white">v{v.version_number}</span> · <span className="text-[#1AFF6E]">{v.status}</span> · {v.change_summary}
              </div>
              <div className="flex gap-2">
                {["draft", "in_review", "approved"].includes(v.status) && (
                  <PrimaryButton onClick={() => handlePublish(v.id)} disabled={busy}>Publicar versión</PrimaryButton>
                )}
                {["published", "superseded"].includes(v.status) && (
                  <SecondaryButton onClick={() => handleRollback(v.id)} disabled={busy}>Restaurar (Rollback)</SecondaryButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "systemic" && (
        <form onSubmit={handleSaveSystemic} className="rounded-xl border border-neutral-800 bg-[#0B0E14] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-amber-300">Configuración Sistémica Protegida (Aislada del CMS Editorial)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="1 USD = ? CLP"><input value={systemForm.usd_to_clp} onChange={(e) => setSystemForm({ ...systemForm, usd_to_clp: e.target.value })} className={INPUT_CLS} /></FormField>
            <FormField label="1 USD = ? ARS"><input value={systemForm.usd_to_ars} onChange={(e) => setSystemForm({ ...systemForm, usd_to_ars: e.target.value })} className={INPUT_CLS} /></FormField>
            <FormField label="WhatsApp Operativo"><input value={systemForm.contact_whatsapp} onChange={(e) => setSystemForm({ ...systemForm, contact_whatsapp: e.target.value })} className={INPUT_CLS} /></FormField>
            <FormField label="Email Operativo"><input value={systemForm.contact_email} onChange={(e) => setSystemForm({ ...systemForm, contact_email: e.target.value })} className={INPUT_CLS} /></FormField>
          </div>
          <PrimaryButton type="submit" disabled={busy}>Guardar Configuración Sistémica</PrimaryButton>
        </form>
      )}
    </div>
  )
}
