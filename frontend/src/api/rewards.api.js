// api/rewards.api.js
import api from "./client"

// ── Públicos ─────────────────────────────────────────────
export const getActiveCampaigns = async () => {
  const { data } = await api.get("/rewards/campaigns/")
  return data.results || data
}

export const getAllCampaigns = async () => {
  const { data } = await api.get("/rewards/campaigns/all/")
  return data
}

export const getCampaign = async (slug) => {
  const { data } = await api.get(`/rewards/campaigns/${slug}/`)
  return data
}

export const getProductParticipation = async (slug) => {
  const { data } = await api.get(`/rewards/product/${slug}/`)
  return data.campaigns || []
}

export const previewCartEntries = async (items) => {
  const { data } = await api.post("/rewards/preview/", { items })
  return data
}

export const getMyEntries = async () => {
  const { data } = await api.get("/rewards/my-entries/")
  return data.results || []
}

export const getPublicWinners = async () => {
  const { data } = await api.get("/rewards/winners/")
  return data.results || []
}

// ── Admin ────────────────────────────────────────────────
export const adminGetRewardsDashboard = async () => {
  const { data } = await api.get("/admin/rewards/dashboard/")
  return data
}

export const adminListCampaigns = async () => {
  const { data } = await api.get("/admin/rewards/campaigns/")
  return data.results || data
}

export const adminGetCampaign = async (id) => {
  const { data } = await api.get(`/admin/rewards/campaigns/${id}/`)
  return data
}

export const adminCreateCampaign = async (formData) => {
  const { data } = await api.post("/admin/rewards/campaigns/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

export const adminUpdateCampaign = async (id, formData) => {
  const { data } = await api.patch(`/admin/rewards/campaigns/${id}/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

export const adminDeleteCampaign = async (id) => {
  await api.delete(`/admin/rewards/campaigns/${id}/`)
}

export const adminDuplicateCampaign = async (id) => {
  const { data } = await api.post(`/admin/rewards/campaigns/${id}/duplicate/`)
  return data
}

export const adminFinishCampaign = async (id) => {
  const { data } = await api.post(`/admin/rewards/campaigns/${id}/finish/`)
  return data
}

export const adminDrawCampaign = async (id) => {
  const { data } = await api.post(`/admin/rewards/campaigns/${id}/draw/`)
  return data
}

export const adminListRewardProducts = async (campaignId) => {
  const { data } = await api.get(`/admin/rewards/products/?campaign=${campaignId}`)
  return data.results || data
}

export const adminAddRewardProduct = async (payload) => {
  const { data } = await api.post("/admin/rewards/products/", payload)
  return data
}

export const adminUpdateRewardProduct = async (id, payload) => {
  const { data } = await api.patch(`/admin/rewards/products/${id}/`, payload)
  return data
}

export const adminDeleteRewardProduct = async (id) => {
  await api.delete(`/admin/rewards/products/${id}/`)
}

export const adminListEntries = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  const { data } = await api.get(`/admin/rewards/entries/?${params}`)
  return data.results || data
}

export const adminExportEntriesCsvUrl = (campaignId) =>
  `/api/v1/admin/rewards/entries/export/${campaignId ? `?campaign=${campaignId}` : ""}`

export const adminListWinners = async (campaignId) => {
  const url = campaignId
    ? `/admin/rewards/winners/?campaign=${campaignId}`
    : `/admin/rewards/winners/`
  const { data } = await api.get(url)
  return data.results || data
}

export const adminUpdateWinner = async (id, formData) => {
  const { data } = await api.patch(`/admin/rewards/winners/${id}/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}
