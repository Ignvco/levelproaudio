// pages/admin/AdminUsers.jsx
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"
import { getAdminRoles, manageUserRole } from "../../api/rbac.api"
import {
  DataTable,
  StatusBadge,
  AdminPageHeader,
  StatCard,
  FormModal,
  SecondaryButton,
  PrimaryButton,
} from "../../components/admin/ui"
import { Users as UsersIcon, UserCheck, ShieldCheck, ShieldAlert, Key, Plus, Trash2 } from "lucide-react"
import { listFromResponse, queryDisplayState } from "../../utils/queryDisplayState"
import { adminUserRole } from "../../utils/adminListData"

const ROLE = {
  super:   { label:"Super",   tone:"info" },
  admin:   { label:"Admin",   tone:"success" },
  cliente: { label:"Cliente", tone:"neutral" },
  unknown: { label:"Sin datos", tone:"neutral" },
}

const ROLE_TONE_MAP = {
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

const HIGH_PRIVILEGE_ROLES = new Set([
  "Super Admin",
  "Gerencia / Administración",
  "Finanzas / Contabilidad",
])

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState("")
  const [selectedUser, setSelectedUser] = useState(null)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleToAssign, setRoleToAssign] = useState("")
  const [actionError, setActionError] = useState(null)
  const [pendingConfirmAction, setPendingConfirmAction] = useState(null)

  const queryClient = useQueryClient()

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn:  () => getAdminUsers({}),
  })

  const rolesQuery = useQuery({
    queryKey: ["admin-roles-list"],
    queryFn: getAdminRoles,
  })

  const availableRoles = rolesQuery.data?.results || []

  const roleMutation = useMutation({
    mutationFn: ({ userId, role, action }) => manageUserRole(userId, role, action),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      queryClient.invalidateQueries({ queryKey: ["admin-roles-list"] })
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] })
      // Actualizar el usuario seleccionado en el modal
      if (selectedUser) {
        setSelectedUser({ ...selectedUser, roles: data.roles })
      }
      setActionError(null)
      setPendingConfirmAction(null)
    },
    onError: (err) => {
      const msg = err.response?.data?.error || "Error al actualizar roles del usuario."
      setActionError(msg)
    },
  })

  const state = queryDisplayState(usersQuery)
  const allUsers = listFromResponse(usersQuery.data).map(u => ({ ...u, _role: adminUserRole(u) }))
  const users = allUsers.filter(u => {
    if (!roleFilter) return true
    if (roleFilter === "super" || roleFilter === "admin" || roleFilter === "cliente") {
      return u._role === roleFilter
    }
    return u.roles?.includes(roleFilter)
  })

  const totalCount = state === "ready" ? (usersQuery.data?.count ?? allUsers.length) : "—"
  const rolesKnown = state === "ready" && allUsers.every(u => u._role !== "unknown")
  const clientCount = rolesKnown ? allUsers.filter(u => u._role === "cliente").length : "—"
  const staffCount = rolesKnown ? allUsers.filter(u => u._role === "admin" || u._role === "super").length : "—"

  const handleOpenRoleModal = (u) => {
    setSelectedUser(u)
    // Nunca seleccionar Super Admin como rol predeterminado; preferir un rol operativo estándar o vacío
    setRoleToAssign("")
    setActionError(null)
    setPendingConfirmAction(null)
    setRoleModalOpen(true)
  }

  const handleRequestRoleChange = (userId, role, action) => {
    if (HIGH_PRIVILEGE_ROLES.has(role) || action === "remove") {
      setPendingConfirmAction({ userId, role, action })
      return
    }
    roleMutation.mutate({ userId, role, action })
  }

  const columns = [
    { key:"first_name", header:"Usuario", sortable:true, render:u => (
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0,
          background:"var(--admin-primary-soft)", color:"var(--admin-primary-text)",
          fontSize:14, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
        </div>
        <div style={{ minWidth:0 }}>
          <p style={{ fontSize:13, fontWeight:700, color:"var(--admin-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {u.first_name || u.last_name ? `${u.first_name||""} ${u.last_name||""}`.trim() : "Sin nombre"}
          </p>
          {u.phone && <p style={{ fontSize:11, color:"var(--admin-text-muted)" }}>{u.phone}</p>}
        </div>
      </div>
    ) },
    { key:"email", header:"Email", sortable:true, render:u => <span style={{ color:"var(--admin-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "12.5px" }}>{u.email}</span> },
    { key:"orders_count", header:"Pedidos", sortable:true, align:"center", render:u => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{u.orders_count || 0}</span> },
    { key:"roles", header:"Roles y Acceso", render:u => {
      const userRoles = u.roles || []
      if (userRoles.length > 0) {
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {userRoles.map(r => (
              <StatusBadge key={r} tone={ROLE_TONE_MAP[r] || "info"}>{r}</StatusBadge>
            ))}
          </div>
        )
      }
      return <StatusBadge tone={ROLE[u._role]?.tone || "neutral"}>{ROLE[u._role]?.label || "Cliente"}</StatusBadge>
    } },
    { key:"date_joined", header:"Registro", sortable:true, render:u => (
      <span style={{ color:"var(--admin-text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
        {new Date(u.date_joined).toLocaleDateString("es-CL", { day:"numeric", month:"short", year:"2-digit" })}
      </span>
    ) },
    { key:"actions", header:"Acciones", align:"right", render:u => (
      <SecondaryButton
        onClick={() => handleOpenRoleModal(u)}
        style={{ fontSize: 11.5, padding: "4px 8px" }}
      >
        <Key size={12} style={{ marginRight: 4 }} /> Roles
      </SecondaryButton>
    ) },
  ]

  return (
    <div className="au-page" data-testid="admin-users-page">
      <AdminPageHeader
        eyebrow="LEVELPRO OS V4.0 / CLIENTES Y EQUIPO"
        title="Usuarios"
        description={state === "ready" ? `${totalCount} usuarios registrados con asignación granular de roles` : undefined}
      />

      <div className="lp-kpi-strip">
        <StatCard
          variant="ink"
          Icon={UsersIcon}
          label="Total usuarios"
          value={totalCount}
          sub="Cuentas registradas"
        />
        <StatCard
          variant="primary"
          Icon={UserCheck}
          label="Clientes"
          value={clientCount}
          sub="En esta vista"
        />
        <StatCard
          variant="light"
          Icon={ShieldCheck}
          label="Equipo Staff / Admin"
          value={staffCount}
          sub="En esta vista"
        />
      </div>

      {state === "ready" && totalCount > allUsers.length && (
        <p className="au-formfield__help">Mostrando {allUsers.length} de {totalCount} usuarios. La búsqueda y los filtros se aplican a esta vista.</p>
      )}
      <DataTable
        columns={columns} data={users} loading={state === "loading"}
        error={state === "error" ? "No se pudieron cargar los usuarios." : null}
        onRetry={() => usersQuery.refetch()}
        getRowId={u => u.id}
        searchable searchKeys={["first_name", "last_name", "email"]}
        searchPlaceholder="Buscar por nombre o email..."
        filters={[{
          label:"Rol", value:roleFilter, onChange:setRoleFilter,
          options:[
            { value:"", label:"Todos los roles" },
            { value:"cliente", label:"Clientes" },
            { value:"admin", label:"Staff / Admin General" },
            { value:"super", label:"Super Admin" },
            ...availableRoles.map(r => ({ value: r.name, label: `Rol: ${r.name}` }))
          ],
        }]}
        emptyIcon={UsersIcon} emptyTitle="No hay usuarios" emptyDesc="No hay usuarios con ese término o filtro."
        testId="users-table" />

      {/* MODAL GESTIÓN DE ROLES RBAC */}
      <FormModal
        open={roleModalOpen}
        title={`Gestionar Roles: ${selectedUser?.email || ""}`}
        onClose={() => setRoleModalOpen(false)}
        saveLabel="Cerrar"
        onSave={() => setRoleModalOpen(false)}
        maxWidth="520px"
      >
        {selectedUser && (
          <div>
            <p style={{ fontSize: 13, color: "var(--admin-text-secondary)", marginBottom: 14 }}>
              Asigna o remueve roles de la estructura empresarial LEVELPRO OS V4.0.
            </p>

            {actionError && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(255, 68, 68, 0.1)",
                  border: "1px solid rgba(255, 68, 68, 0.3)",
                  color: "#FF4444",
                  fontSize: 12,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ShieldAlert size={14} />
                <span>{actionError}</span>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--admin-text-muted)", display: "block", marginBottom: 6 }}>
                Roles Activos Actualmente
              </label>
              {selectedUser.roles && selectedUser.roles.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedUser.roles.map(r => (
                    <div
                      key={r}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--admin-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <StatusBadge tone={ROLE_TONE_MAP[r] || "info"}>{r}</StatusBadge>
                      <SecondaryButton
                        onClick={() => handleRequestRoleChange(selectedUser.id, r, "remove")}
                        style={{ fontSize: 11, padding: "2px 6px", color: "#FF4444" }}
                        disabled={roleMutation.isPending}
                      >
                        <Trash2 size={12} style={{ marginRight: 4 }} /> Revocar
                      </SecondaryButton>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: "var(--admin-text-muted)", fontStyle: "italic" }}>
                  Sin roles empresariales asignados (Cliente estándar).
                </p>
              )}
            </div>

            {pendingConfirmAction && (
              <div
                data-testid="role-privilege-confirmation"
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  marginBottom: 14,
                }}
              >
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "#D97706", margin: "0 0 6px" }}>
                  Confirmación de operación de privilegios elevados
                </p>
                <p style={{ fontSize: 12, color: "var(--admin-text-secondary)", margin: "0 0 10px" }}>
                  {pendingConfirmAction.action === "assign"
                    ? `¿Confirmas otorgar el rol privilegiado "${pendingConfirmAction.role}" a ${selectedUser.email}?`
                    : `¿Confirmas revocar el rol "${pendingConfirmAction.role}" de ${selectedUser.email}?`}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <PrimaryButton
                    onClick={() => roleMutation.mutate(pendingConfirmAction)}
                    disabled={roleMutation.isPending}
                    size="sm"
                  >
                    Confirmar operación
                  </PrimaryButton>
                  <SecondaryButton
                    onClick={() => setPendingConfirmAction(null)}
                    disabled={roleMutation.isPending}
                    size="sm"
                  >
                    Cancelar
                  </SecondaryButton>
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--admin-text-muted)", display: "block", marginBottom: 6 }}>
                Asignar Nuevo Rol
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={roleToAssign}
                  onChange={(e) => {
                    setRoleToAssign(e.target.value)
                    setPendingConfirmAction(null)
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    color: "var(--admin-text)",
                    fontSize: 13,
                  }}
                >
                  <option value="">Selecciona un rol empresarial...</option>
                  {availableRoles.map(r => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <PrimaryButton
                  onClick={() => handleRequestRoleChange(selectedUser.id, roleToAssign, "assign")}
                  disabled={roleMutation.isPending || !roleToAssign || selectedUser.roles?.includes(roleToAssign)}
                >
                  <Plus size={13} style={{ marginRight: 4 }} /> Asignar
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  )
}
