// api/rbac.api.js
/**
 * Cliente API para el Core de Seguridad y RBAC Granular en LEVELPRO OS V4.0.
 */

import api from "./client"

export const getMyPermissions = () =>
  api.get("/auth/me/permissions/").then((r) => r.data)

export const getAdminRoles = () =>
  api.get("/admin/roles/").then((r) => r.data)

export const getAdminRoleDetail = (roleName) =>
  api.get(`/admin/roles/${encodeURIComponent(roleName)}/`).then((r) => r.data)

export const getUserRoles = (userId) =>
  api.get(`/admin/users/${userId}/roles/`).then((r) => r.data)

export const manageUserRole = (userId, role, action = "assign") =>
  api.post(`/admin/users/${userId}/roles/`, { role, action }).then((r) => r.data)

export const getPermissionsCatalog = () =>
  api.get("/admin/permissions/catalog/").then((r) => r.data)
