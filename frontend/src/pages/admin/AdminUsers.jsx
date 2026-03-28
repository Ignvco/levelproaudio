// pages/admin/AdminUsers.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminUsers } from "../../api/admin.api"
import api from "../../api/client"

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    first_name:  user?.first_name  || "",
    last_name:   user?.last_name   || "",
    phone:       user?.phone       || "",
    is_active:   user?.is_active   ?? true,
    is_staff:    user?.is_staff    ?? false,
  })
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [error, setError]       = useState("")

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      await api.patch(`/admin/users/${user.id}/`, form)
      onSave()
      onClose()
    } catch {
      setError("Error al guardar.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${user.id}/`)
      onSave()
      onClose()
    } catch {
      setError("Error al eliminar.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "100%", maxWidth: "480px",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "var(--surface-3)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: 600,
            }}>
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500 }}>
                {user.first_name || user.email}
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {user.email}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "20px" }}>×</button>
        </div>

        {/* Form */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "first_name", label: "Nombre" },
              { key: "last_name",  label: "Apellido" },
              { key: "phone",      label: "Teléfono" },
            ].map(({ key, label }) => (
              <div key={key} style={{ gridColumn: key === "phone" ? "span 2" : undefined }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 500,
                  color: "var(--text-3)", marginBottom: "6px",
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </label>
                <input value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="input" style={{ fontSize: "13px" }} />
              </div>
            ))}
          </div>

          {/* Stats — solo lectura */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
            padding: "14px", background: "var(--surface-2)",
            borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
            {[
              { label: "Pedidos",       value: user.orders_count },
              { label: "Total gastado", value: `$${Number(user.total_spent || 0).toLocaleString("es-CL")}` },
              { label: "Registro",      value: user.date_joined },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.06em", fontWeight: 500, marginBottom: "2px" }}>
                  {label}
                </p>
                <p style={{ fontSize: "13px" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Checkboxes */}
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { key: "is_active", label: "Cuenta activa" },
              { key: "is_staff",  label: "Es administrador" },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center",
                gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                <input type="checkbox" checked={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  style={{ accentColor: "var(--accent)", width: "15px", height: "15px" }} />
                {label}
              </label>
            ))}
          </div>

          {/* Confirmar eliminación */}
          {confirm && (
            <div style={{ padding: "14px 16px", borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.3)" }}>
              <p style={{ fontSize: "13px", color: "var(--danger)", marginBottom: "12px" }}>
                ¿Estás seguro? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ padding: "7px 16px", borderRadius: "var(--r-sm)",
                    background: "var(--danger)", color: "#fff", border: "none",
                    cursor: "pointer", fontSize: "12px", fontWeight: 500,
                    opacity: deleting ? 0.7 : 1 }}>
                  {deleting ? "Eliminando..." : "Confirmar"}
                </button>
                <button onClick={() => setConfirm(false)}
                  className="btn btn-ghost"
                  style={{ padding: "7px 16px", fontSize: "12px" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setConfirm(true)}
            style={{ fontSize: "12px", color: "var(--danger)", background: "none",
              border: "none", cursor: "pointer", padding: 0,
              transition: "opacity var(--dur)" }}
            className="hover:opacity-70">
            Eliminar usuario
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onClose} className="btn btn-ghost"
              style={{ padding: "9px 18px", fontSize: "13px" }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="btn btn-accent"
              style={{ padding: "9px 18px", fontSize: "13px",
                opacity: saving ? 0.7 : 1 }}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [search, setSearch]           = useState("")
  const [selectedUser, setSelectedUser] = useState(null)
  const queryClient                   = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn:  () => getAdminUsers({ ...(search && { search }) }),
  })

  const users  = data?.results || []
  const onSave = () => queryClient.invalidateQueries(["admin-users"])

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      {selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={onSave}
        />
      )}

      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px" }}>
          Usuarios
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {data?.count || 0} usuarios — click en una fila para editar
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
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "52px" }} />
          ))}
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
            <div key={u.id}
              onClick={() => setSelectedUser(u)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
                padding: "13px 20px", alignItems: "center",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
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
                  color: u.is_staff ? "var(--accent)" : "var(--text)",
                  border: u.is_staff ? "1px solid rgba(26,255,110,0.3)" : "none",
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
                  ? `${u.first_name} ${u.last_name}`.trim() : "—"}
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