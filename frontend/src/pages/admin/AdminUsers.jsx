// pages/admin/AdminUsers.jsx
import { useQuery } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"

export default function AdminUsers() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn:  getAdminUsers,
  })
  const users = data?.results || data || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 300,
          letterSpacing: "-0.02em", marginBottom: "6px" }}>
          Usuarios
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {users.length} usuarios registrados
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px" }} />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", overflow: "hidden" }}>

          {/* Header tabla */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
            padding: "10px 20px",
            borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span>Usuario</span>
            <span>Email</span>
            <span>Pedidos</span>
            <span>Rol</span>
            <span>Registro</span>
          </div>

          {users.map((u, i) => (
            <div key={u.id} style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
              padding: "14px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
              gap: "8px",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width:           "34px",
                  height:          "34px",
                  borderRadius:    "50%",
                  background:      "var(--accent-dim)",
                  border:          "1px solid var(--accent-glow)",
                  color:           "var(--accent)",
                  fontSize:        "13px",
                  fontWeight:      600,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  flexShrink:      0,
                }}>
                  {u.first_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 500 }}>
                    {u.first_name} {u.last_name}
                  </p>
                </div>
              </div>

              <span style={{ fontSize: "12px", color: "var(--text-2)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.email}
              </span>

              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                {u.orders_count || 0}
              </span>

              <span style={{
                padding: "3px 8px", borderRadius: "var(--r-full)",
                fontSize: "11px", fontWeight: 500,
                color:       u.is_staff ? "var(--accent)" : "var(--text-3)",
                background:  u.is_staff ? "var(--accent-dim)" : "var(--surface-2)",
                border:      `1px solid ${u.is_staff ? "var(--accent-glow)" : "var(--border)"}`,
                display:     "inline-block",
              }}>
                {u.is_superuser ? "Super" : u.is_staff ? "Admin" : "Cliente"}
              </span>

              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {new Date(u.date_joined).toLocaleDateString("es-CL", {
                  day: "numeric", month: "short", year: "2-digit"
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}