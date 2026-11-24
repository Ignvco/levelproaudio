// api/siteSettings.api.js — Personalización del sitio
import api from "./client"

// Público — para lectura desde toda la web
export const getSiteSettings = () =>
  api.get("/site-settings/").then(r => r.data)

// Admin — GET
export const getAdminSiteSettings = () =>
  api.get("/admin/site-settings/").then(r => r.data)

// Admin — PATCH (soporta multipart para imágenes)
export const updateSiteSettings = (data, files = {}) => {
  const hasFiles = Object.values(files).some(f => f instanceof File)
  if (hasFiles) {
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== null && v !== undefined) fd.append(k, typeof v === "boolean" ? String(v) : v)
    })
    Object.entries(files).forEach(([k, f]) => {
      if (f instanceof File) fd.append(k, f)
    })
    // El request interceptor de client.js borra Content-Type cuando data es
    // FormData, así el browser inyecta el boundary del multipart automáticamente.
    return api.patch("/admin/site-settings/", fd).then(r => r.data)
  }
  return api.patch("/admin/site-settings/", data).then(r => r.data)
}

// ── Gate 12: Editorial CMS (BF-30, BF-31) ─────────────────────
export const getCmsVersions = () =>
  api.get("/admin/cms/versions/").then(r => r.data)

export const createCmsDraft = (changeSummary = "") =>
  api.post("/admin/cms/versions/", { change_summary: changeSummary }).then(r => r.data)

export const getCmsVersion = (versionId) =>
  api.get(`/admin/cms/versions/${versionId}/`).then(r => r.data)

export const updateCmsDraft = (versionId, payload, changeSummary) =>
  api.patch(`/admin/cms/versions/${versionId}/`, { payload, change_summary: changeSummary }).then(r => r.data)

export const previewCmsVersion = (versionId) =>
  api.get(`/admin/cms/versions/${versionId}/preview/`).then(r => r.data)

export const reviewCmsVersion = (versionId, targetStatus) =>
  api.post(`/admin/cms/versions/${versionId}/review/`, { target_status: targetStatus }).then(r => r.data)

export const publishCmsVersion = (versionId, notes = "") =>
  api.post(`/admin/cms/versions/${versionId}/publish/`, { notes }).then(r => r.data)

export const rollbackCmsVersion = (versionId, notes = "") =>
  api.post(`/admin/cms/versions/${versionId}/rollback/`, { notes }).then(r => r.data)

export const getCmsAssets = () =>
  api.get("/admin/cms/assets/").then(r => r.data)

export const uploadCmsAsset = (file, meta = {}) => {
  const fd = new FormData()
  fd.append("file", file)
  if (meta.title) fd.append("title", meta.title)
  if (meta.alt_text) fd.append("alt_text", meta.alt_text)
  if (meta.device_target) fd.append("device_target", meta.device_target)
  return api.post("/admin/cms/assets/", fd).then(r => r.data)
}

export const saveCmsHeroSlide = (data) =>
  api.post("/admin/cms/hero-slides/", data).then(r => r.data)

export const getCmsBanners = (versionId) =>
  api.get("/admin/cms/banners/", { params: versionId ? { version_id: versionId } : {} }).then(r => r.data)

export const saveCmsBanner = (data) =>
  api.post("/admin/cms/banners/", data).then(r => r.data)

export const saveCmsAnnouncement = (data) =>
  api.post("/admin/cms/announcements/", data).then(r => r.data)

export const getCmsEvents = () =>
  api.get("/admin/cms/events/").then(r => r.data)
