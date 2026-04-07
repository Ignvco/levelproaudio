// pages/admin/AdminUsers.jsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"

export default function AdminUsers() {
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn:  () => getAdminUsers(search ? { search } : {}),
  })
  const users = data?.results || data || []

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end",
        marginBottom:"28px", flexWrap:"wrap", gap:"16px" }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>Usuarios</h1>
          <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
            {data?.count || users.length} usuarios registrados
          </p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          style={{ padding:"9px 16px", fontSize:"13px", outline:"none",
            background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"var(--r-full)", color:"var(--text)", width:"280px",
            transition:"border-color var(--dur)" }}
          onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"} />
      </div>

      {isLoading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {[...Array(6)].map((_,i) => <div key={i} className="skeleton" style={{ height:"60px" }} />)}
        </div>
      ) : users.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)",
          border:"1px solid var(--border)", borderRadius:"var(--r-2xl)",
          color:"var(--text-3)" }}>
          <p style={{ fontSize:"40px", marginBottom:"12px" }}>👤</p>
          <p style={{ fontSize:"14px" }}>No hay usuarios con ese término.</p>
        </div>
      ) : (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>

          {/* Header tabla */}
          <div style={{ display:"grid", gridTemplateColumns:"2.5fr 2fr 1fr 1fr 1fr",
            padding:"10px 20px", borderBottom:"1px solid var(--border)",
            fontSize:"11px", fontWeight:500, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.08em" }}>
            <span>Usuario</span><span>Email</span>
            <span>Pedidos</span><span>Rol</span><span>Registro</span>
          </div>

          {users.map((u, i) => (
            <div key={u.id} style={{ display:"grid",
              gridTemplateColumns:"2.5fr 2fr 1fr 1fr 1fr",
              padding:"13px 20px", alignItems:"center", gap:"8px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition:"background var(--dur) var(--ease)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

              {/* Avatar + nombre */}
              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"36px", height:"36px", borderRadius:"50%", flexShrink:0,
                  background:  u.is_staff ? "var(--accent-dim)" : "var(--surface-2)",
                  border:      `1px solid ${u.is_staff ? "var(--accent-glow)" : "var(--border)"}`,
                  color:       u.is_staff ? "var(--accent)" : "var(--text-3)",
                  fontSize:"14px", fontWeight:600,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:"13px", fontWeight:500, overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {u.first_name || u.last_name
                      ? `${u.first_name||""} ${u.last_name||""}`.trim()
                      : "Sin nombre"}
                  </p>
                  {u.phone && <p style={{ fontSize:"11px", color:"var(--text-3)" }}>{u.phone}</p>}
                </div>
              </div>

              <span style={{ fontSize:"12px", color:"var(--text-2)", overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</span>

              <span style={{ fontSize:"14px", fontWeight:500 }}>{u.orders_count || 0}</span>

              <span style={{ padding:"3px 10px", borderRadius:"var(--r-full)", fontSize:"11px",
                fontWeight:500, display:"inline-block",
                color:      u.is_superuser ? "#c084fc" : u.is_staff ? "var(--accent)" : "var(--text-3)",
                background: u.is_superuser ? "rgba(192,132,252,0.1)" : u.is_staff ? "var(--accent-dim)" : "var(--surface-2)",
                border:     `1px solid ${u.is_superuser ? "rgba(192,132,252,0.3)" : u.is_staff ? "var(--accent-glow)" : "var(--border)"}` }}>
                {u.is_superuser ? "Super" : u.is_staff ? "Admin" : "Cliente"}
              </span>

              <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
                {new Date(u.date_joined).toLocaleDateString("es-CL", {
                  day:"numeric", month:"short", year:"2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
