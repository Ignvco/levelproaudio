// pages/admin/AdminUsers.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"
import { DataTable, StatusBadge, AdminPageHeader } from "../../components/admin/ui"
import { Users as UsersIcon } from "lucide-react"

const roleOf = (u) => u.is_superuser ? "super" : u.is_staff ? "admin" : "cliente"
const ROLE = {
  super:   { label:"Super",   tone:"info" },
  admin:   { label:"Admin",   tone:"success" },
  cliente: { label:"Cliente", tone:"neutral" },
}

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn:  () => getAdminUsers({}),
  })

  const users = (data?.results || data || [])
    .map(u => ({ ...u, _role: roleOf(u) }))
    .filter(u => !roleFilter || u._role === roleFilter)

  const columns = [
    { key:"first_name", header:"Usuario", sortable:true, render:u => (
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0,
          background:"var(--admin-primary-soft)", color:"var(--admin-primary-text)",
          fontSize:14, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
        </div>
        <div style={{ minWidth:0 }}>
          <p style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {u.first_name || u.last_name ? `${u.first_name||""} ${u.last_name||""}`.trim() : "Sin nombre"}
          </p>
          {u.phone && <p style={{ fontSize:11, color:"var(--admin-text-muted)" }}>{u.phone}</p>}
        </div>
      </div>
    ) },
    { key:"email", header:"Email", sortable:true, render:u => <span style={{ color:"var(--admin-text-muted)" }}>{u.email}</span> },
    { key:"orders_count", header:"Pedidos", sortable:true, align:"center", render:u => u.orders_count || 0 },
    { key:"_role", header:"Rol", render:u => <StatusBadge tone={ROLE[u._role].tone}>{ROLE[u._role].label}</StatusBadge> },
    { key:"date_joined", header:"Registro", sortable:true, render:u => (
      <span style={{ color:"var(--admin-text-muted)" }}>
        {new Date(u.date_joined).toLocaleDateString("es-CL", { day:"numeric", month:"short", year:"2-digit" })}
      </span>
    ) },
  ]

  return (
    <div className="au-page" style={{ padding:"clamp(24px, 4vw, 40px)" }}>
      <AdminPageHeader eyebrow="Clientes" title="Usuarios"
        description={`${data?.count || (data?.results || data || []).length || 0} usuarios registrados`} />

      <DataTable
        columns={columns} data={users} loading={isLoading}
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
