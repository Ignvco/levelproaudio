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
    return api.patch("/admin/site-settings/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data)
  }
  return api.patch("/admin/site-settings/", data).then(r => r.data)
}
