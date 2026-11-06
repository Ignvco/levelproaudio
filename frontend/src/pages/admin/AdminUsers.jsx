// pages/admin/AdminUsers.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"
import { DataTable, StatusBadge, AdminPageHeader, StatCard } from "../../components/admin/ui"
import { Users as UsersIcon, UserCheck, ShieldCheck } from "lucide-react"
import { listFromResponse, queryDisplayState } from "../../utils/queryDisplayState"
import { adminUserRole } from "../../utils/adminListData"

const ROLE = {
  super:   { label:"Super",   tone:"info" },
  admin:   { label:"Admin",   tone:"success" },
  cliente: { label:"Cliente", tone:"neutral" },
  unknown: { label:"Sin datos", tone:"neutral" },
}

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState("")

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn:  () => getAdminUsers({}),
  })

  const state = queryDisplayState(usersQuery)
  const allUsers = listFromResponse(usersQuery.data).map(u => ({ ...u, _role: adminUserRole(u) }))
  const users = allUsers.filter(u => !roleFilter || u._role === roleFilter)
  const totalCount = state === "ready" ? (usersQuery.data?.count ?? allUsers.length) : "—"
  const rolesKnown = state === "ready" && allUsers.every(u => u._role !== "unknown")
  const clientCount = rolesKnown ? allUsers.filter(u => u._role === "cliente").length : "—"
  const staffCount = rolesKnown ? allUsers.filter(u => u._role === "admin" || u._role === "super").length : "—"

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
    { key:"_role", header:"Rol", render:u => <StatusBadge tone={ROLE[u._role].tone}>{ROLE[u._role].label}</StatusBadge> },
    { key:"date_joined", header:"Registro", sortable:true, render:u => (
      <span style={{ color:"var(--admin-text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
        {new Date(u.date_joined).toLocaleDateString("es-CL", { day:"numeric", month:"short", year:"2-digit" })}
      </span>
    ) },
  ]

  return (
    <div className="au-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / CLIENTES"
        title="Usuarios"
        description={state === "ready" ? `${totalCount} usuarios registrados en la plataforma` : undefined}
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
          options:[{ value:"", label:"Todos los roles" },
            ...Object.entries(ROLE).map(([v, { label }]) => ({ value:v, label }))],
        }]}
        emptyIcon={UsersIcon} emptyTitle="No hay usuarios" emptyDesc="No hay usuarios con ese término o filtro."
        testId="users-table" />
    </div>
  )
}
