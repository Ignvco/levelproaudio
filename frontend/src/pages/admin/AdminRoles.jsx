// pages/admin/AdminRoles.jsx
/**
 * LEVELPRO OS V4.0 — Security Core: Roles y Control de Acceso (RBAC Granular)
 * Diseño Editorial Bento de alta fidelidad, Geist / Geist Mono, verde oficial #1AFF6E.
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAdminRoles, getPermissionsCatalog, getAdminRoleDetail } from "../../api/rbac.api"
import {
  AdminPageHeader,
  StatCard,
  StatusBadge,
  AdminTabs,
  FormModal,
  PrimaryButton,
  SecondaryButton,
} from "../../components/admin/ui"
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Users,
  Lock,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  ChevronRight,
  UserCheck,
  Building,
} from "lucide-react"

const TONE_BY_ROLE = {
  "Super Admin": "error",
  "Gerencia / Administración": "warning",
  "Ventas": "success",
  "Compras": "info",
  "Bodega": "neutral",
  "Logística": "neutral",
  "Finanzas / Contabilidad": "warning",
  "Marketing": "info",
  "Academia": "success",
  "Soporte Técnico": "neutral",
}

const CAPABILITY_LABELS = {
  view_costs: "Ver Costos de Adquisición",
  edit_costs: "Modificar Costos",
  view_margins: "Ver Márgenes y Rentabilidad",
  view_finances: "Consultar Módulo Financiero",
  manage_finances: "Ejecutar Retiros y Modificar Finanzas",
  approve_payments: "Aprobar Pagos Manuales",
  edit_prices: "Modificar Precios de Venta",
  apply_discounts: "Aplicar Descuentos Comerciales",
  adjust_inventory: "Ajustar Existencias de Bodega",
  export_data: "Exportar Datos y Reportes",
  manage_roles: "Administrar Roles y Staff",
  manage_settings: "Configuración Crítica y Tasas FX",
  view_audit: "Consultar Registro de Auditoría",
  view_security_audit: "Consultar Eventos de Seguridad",
  view_financial_audit: "Consultar Auditoría Financiera y Costos",
  export_audit: "Exportar Registro de Auditoría",
}

const CAPABILITY_SHORT_LABELS = {
  view_costs: "Ver Costos",
  edit_costs: "Editar Costos",
  view_margins: "Ver Márgenes",
  view_finances: "Ver Finanzas",
  manage_finances: "Operar Finanzas",
  approve_payments: "Aprobar Pagos",
  edit_prices: "Editar Precios",
  apply_discounts: "Descuentos",
  adjust_inventory: "Ajustar Stock",
  export_data: "Exportar Datos",
  manage_roles: "Gestionar Roles",
  manage_settings: "Configuración y FX",
  view_audit: "Ver Auditoría",
  view_security_audit: "Auditoría Seguridad",
  view_financial_audit: "Auditoría Financiera",
  export_audit: "Exportar Auditoría",
}

const ACTION_LABELS = {
  read: "Lectura",
  create: "Crear",
  update: "Editar",
  delete: "Eliminar",
  export: "Exportar",
  import: "Importar",
  approve: "Aprobar",
}

const MODULE_LABELS = {
  dashboard: "Dashboard Ejecutivo",
  catalog: "Catálogo de Productos",
  orders: "Órdenes y Ventas",
  inventory: "Existencias e Inventario",
  purchases: "Compras y Proveedores",
  logistics: "Despachos y Logística",
  finances: "Finanzas y Conciliación",
  marketing: "Fidelización y Rewards",
  academy: "Academia y Cursos",
  services: "Servicios Técnicos",
  roles: "Seguridad y RBAC",
  settings: "Personalización y Ajustes",
  audit: "Auditoría y Actividad",
}

export default function AdminRoles() {
  const [activeTab, setActiveTab] = useState("roles")
  const [selectedRole, setSelectedRole] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // Consultas React Query
  const rolesQuery = useQuery({
    queryKey: ["admin-roles-list"],
    queryFn: getAdminRoles,
  })

  const catalogQuery = useQuery({
    queryKey: ["admin-permissions-catalog"],
    queryFn: getPermissionsCatalog,
  })

  const roleDetailQuery = useQuery({
    queryKey: ["admin-role-detail", selectedRole],
    queryFn: () => getAdminRoleDetail(selectedRole),
    enabled: Boolean(selectedRole),
  })

  const roles = rolesQuery.data?.results || []
  const catalog = catalogQuery.data || { modules: [], capabilities: [], role_matrix: {} }
  const totalUsersInRoles = roles.reduce((acc, r) => acc + (r.user_count || 0), 0)

  const handleOpenDetail = (roleName) => {
    setSelectedRole(roleName)
    setDetailModalOpen(true)
  }

  const tabs = [
    { key: "roles", label: "Roles Empresariales", badge: roles.length },
    { key: "matrix", label: "Matriz de Permisos 360°" },
  ]

  return (
    <div className="au-page" data-testid="admin-roles-page">
      <AdminPageHeader
        eyebrow="LEVELPRO OS V4.0 / SEGURIDAD"
        title="Roles y Control de Acceso (RBAC)"
        description="Segregación de funciones empresariales, capacidades sensibles y control granular de acceso."
      />

      {/* KPI STRIP */}
      <div className="lp-kpi-strip">
        <StatCard
          variant="ink"
          Icon={ShieldCheck}
          label="Roles Oficiales"
          value={roles.length || 10}
          sub="Estructura organizacional activa"
        />
        <StatCard
          variant="primary"
          Icon={Key}
          label="Capacidades Sensibles"
          value={catalog.capabilities?.length || 12}
          sub="Permisos críticos protegidos"
        />
        <StatCard
          variant="light"
          Icon={Building}
          label="Módulos del Sistema"
          value={catalog.modules?.length || 12}
          sub="Segregación de funciones"
        />
        <StatCard
          variant="ink"
          Icon={Users}
          label="Asignaciones de Staff"
          value={totalUsersInRoles}
          sub="Cuentas con privilegios activos"
        />
      </div>

      {/* TABS */}
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <AdminTabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
      </div>

      {/* TAB 1: BENTO ROLES */}
      {activeTab === "roles" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 16,
          }}
          data-testid="roles-grid"
        >
          {roles.map((role) => {
            const tone = TONE_BY_ROLE[role.name] || "neutral"
            return (
              <div
                key={role.name}
                className="au-card"
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 12,
                  border: "1px solid var(--admin-border)",
                  background: "var(--admin-surface)",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <StatusBadge tone={tone}>{role.name}</StatusBadge>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                        color: "var(--admin-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Users size={13} /> {role.user_count} {role.user_count === 1 ? "usuario" : "usuarios"}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--admin-text-secondary)",
                      lineHeight: 1.5,
                      marginBottom: 16,
                      minHeight: 40,
                    }}
                  >
                    {role.description}
                  </p>

                  <div style={{ marginBottom: 14 }}>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--admin-text-muted)",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Módulos Habilitados ({role.modules?.length || 0})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {role.modules?.slice(0, 6).map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "var(--admin-primary-soft)",
                            color: "var(--admin-primary-text)",
                            fontWeight: 600,
                          }}
                          title={m}
                        >
                          {MODULE_LABELS[m] || m}
                        </span>
                      ))}
                      {role.modules?.length > 6 && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "var(--admin-surface-secondary, #F4F4F5)",
                            color: "var(--admin-text-muted)",
                          }}
                        >
                          +{role.modules.length - 6} más
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--admin-text-muted)",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Capacidades Sensibles ({role.capabilities?.length || 0})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {role.capabilities && role.capabilities.length > 0 ? (
                        role.capabilities.map((c) => (
                          <span
                            key={c}
                            style={{
                              fontSize: 10.5,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "rgba(26, 255, 110, 0.1)",
                              color: "var(--admin-primary-text)",
                              fontWeight: 600,
                              border: "1px solid rgba(26, 255, 110, 0.3)",
                            }}
                            title={c}
                          >
                            {CAPABILITY_LABELS[c] || c}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--admin-text-muted)", fontStyle: "italic" }}>
                          Sin permisos sensibles (Operativo estándar)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--admin-border)" }}>
                  <SecondaryButton
                    onClick={() => handleOpenDetail(role.name)}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Ver Usuarios y Capacidades <ChevronRight size={14} style={{ marginLeft: 4 }} />
                  </SecondaryButton>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB 2: MATRIZ COMPLETA DE PERMISOS */}
      {activeTab === "matrix" && (
        <div
          className="au-card"
          style={{
            padding: 20,
            borderRadius: 12,
            border: "1px solid var(--admin-border)",
            background: "var(--admin-surface)",
            overflowX: "auto",
          }}
          data-testid="permissions-matrix"
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 6px 0" }}>
              Matriz de Segregación de Funciones LEVELPRO OS V4.0
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--admin-text-muted)", margin: 0 }}>
              Cruce exhaustivo de los 10 roles empresariales con los 12 módulos y las {catalog.capabilities?.length || 12} capacidades sensibles protegidas.
            </p>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                <th style={{ padding: "12px 10px", color: "var(--admin-text)", fontWeight: 700, minWidth: 200 }}>
                  Rol Empresarial
                </th>
                <th style={{ padding: "12px 10px", color: "var(--admin-text-muted)", textAlign: "center" }}>
                  Módulos
                </th>
                {catalog.capabilities?.map((cap) => (
                  <th
                    key={cap}
                    style={{
                      padding: "12px 8px",
                      color: "var(--admin-text-muted)",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                    title={`${CAPABILITY_LABELS[cap] || cap} (${cap})`}
                  >
                    {CAPABILITY_SHORT_LABELS[cap] || CAPABILITY_LABELS[cap] || cap}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const config = catalog.role_matrix?.[r.name] || {}
                const caps = config.capabilities || []
                return (
                  <tr
                    key={r.name}
                    style={{
                      borderBottom: "1px solid var(--admin-border, #E4E4F0)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "12px 10px", fontWeight: 600, color: "var(--admin-text)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StatusBadge tone={TONE_BY_ROLE[r.name] || "neutral"}>{r.name}</StatusBadge>
                      </div>
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "center", fontFamily: "var(--font-mono)" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "var(--admin-primary-soft)",
                          color: "var(--admin-primary-text)",
                        }}
                      >
                        {config.modules?.length || 0} / 12
                      </span>
                    </td>
                    {catalog.capabilities?.map((cap) => {
                      const hasCap = caps.includes(cap)
                      return (
                        <td key={cap} style={{ padding: "12px 8px", textAlign: "center" }}>
                          {hasCap ? (
                            <CheckCircle2 size={16} color="#0F7A38" style={{ display: "inline-block" }} />
                          ) : (
                            <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DETALLE DE ROL */}
      <FormModal
        open={detailModalOpen}
        title={`Detalle de Rol: ${selectedRole}`}
        onClose={() => setDetailModalOpen(false)}
        saveLabel="Cerrar"
        onSave={() => setDetailModalOpen(false)}
        maxWidth="680px"
        scrollableBody
      >
        {roleDetailQuery.isLoading ? (
          <p style={{ color: "var(--admin-text-muted)", fontSize: 13, padding: 16 }}>Cargando especificación de rol...</p>
        ) : (
          <div style={{ padding: "8px 0" }}>
            <p style={{ fontSize: 13, color: "var(--admin-text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
              {roleDetailQuery.data?.description}
            </p>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--admin-text-muted)", letterSpacing: "0.05em", marginBottom: 8 }}>
                Módulos Habilitados y Acciones Granulares
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {roleDetailQuery.data?.modules?.map((m) => {
                  const modStatus = catalog.module_status?.[m]?.status
                  const actions = roleDetailQuery.data?.module_actions?.[m] || []
                  return (
                    <div
                      key={m}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "#FAFAFA",
                        border: "1px solid var(--admin-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 size={13} color="#0F7A38" />
                          <span style={{ fontWeight: 600 }}>{MODULE_LABELS[m] || m}</span>
                        </div>
                        {modStatus === "partial_reserved" && (
                          <span
                            style={{
                              fontSize: 9.5,
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "#FEF3C7",
                              color: "#92400E",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            PARCIAL / RESERVADO
                          </span>
                        )}
                      </div>
                      {actions.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, paddingLeft: 19 }}>
                          {actions.map((act) => (
                            <span
                              key={act}
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "#F4F4F5",
                                color: "var(--admin-text-secondary)",
                                fontWeight: 600,
                              }}
                              title={act}
                            >
                              {ACTION_LABELS[act] || act}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--admin-text-muted)", letterSpacing: "0.05em", marginBottom: 8 }}>
                Capacidades Sensibles Autorizadas
              </h4>
              {roleDetailQuery.data?.capabilities?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {roleDetailQuery.data?.capabilities?.map((c) => (
                    <div
                      key={c}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#F0FDF4",
                        border: "1px solid #BBF7D0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Lock size={13} color="#0F7A38" />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--admin-text)" }}>
                          {CAPABILITY_LABELS[c] || c}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: "#0F7A38" }}>{c}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: "var(--admin-text-muted)", fontStyle: "italic" }}>
                  Este rol no cuenta con acceso a capacidades sensibles.
                </p>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--admin-text-muted)", letterSpacing: "0.05em", marginBottom: 8 }}>
                Usuarios con este Rol ({roleDetailQuery.data?.users?.length || 0})
              </h4>
              {roleDetailQuery.data?.users?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                  {roleDetailQuery.data?.users?.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#FAFAFA",
                        border: "1px solid var(--admin-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                        {u.email}
                      </span>
                      <StatusBadge tone={u.is_active ? "success" : "neutral"}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: "var(--admin-text-muted)", fontStyle: "italic" }}>
                  No hay usuarios asignados actualmente a este rol.
                </p>
              )}
            </div>
          </div>
        )}
      </FormModal>
    </div>
  )
}
