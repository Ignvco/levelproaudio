// pages/admin/AdminUsers.jsx

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"

export default function AdminUsers() {
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn:  () => getAdminUsers({ ...(search && { search }) }),
  })

  const users = data?.results || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Usuarios
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {data?.count || 0} usuarios registrados
        </p>
      </div>

      <input
        placeholder="Buscar por email o nombre..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input"
        style={{ maxWidth: "320px", marginBottom: "20px" }}
      />

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: "52px" }} />)}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden" }}>

          <div style={{ display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Email</span>
            <span>Nombre</span>
            <span>Pedidos</span>
            <span>Gastado</span>
            <span>Registro</span>
          </div>

          {users.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px" }}>
              No se encontraron usuarios.
            </div>
          ) : users.map((u, i) => (
            <div key={u.id} style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
              padding: "13px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }}
              className="hover:bg-[var(--surface-2)]"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "var(--surface-3)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: 600, flexShrink: 0,
                }}>
                  {u.email[0].toUpperCase()}
                </div>
                <span style={{ fontSize: "13px", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.email}
                </span>
              </div>

              <span style={{ fontSize: "13px", color: "var(--text-2)" }}>
                {u.first_name || u.last_name
                  ? `${u.first_name} ${u.last_name}`.trim()
                  : "—"}
              </span>

              <span style={{ fontSize: "13px" }}>{u.orders_count}</span>

              <span style={{ fontSize: "13px", fontWeight: u.total_spent > 0 ? 500 : 400,
                color: u.total_spent > 0 ? "var(--text)" : "var(--text-3)" }}>
                {u.total_spent > 0
                  ? `$${Number(u.total_spent).toLocaleString("es-CL")}`
                  : "—"}
              </span>

              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {u.date_joined}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}