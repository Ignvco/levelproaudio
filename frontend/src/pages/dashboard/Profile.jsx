// pages/dashboard/Profile.jsx — Perfil de usuario y seguridad
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Shield,
  Check,
  Save,
  AlertCircle,
  KeyRound,
} from "lucide-react"
import { useAuthStore } from "../../store/authStore"
import api from "../../api/client"
import { showToast } from "../../components/ui/ToastNotification"
import {
  AdminPageHeader,
  PrimaryButton,
  SecondaryButton,
} from "../../components/admin/ui"

function ChangePasswordSection() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ current_password: "", password: "", password2: "" })
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/auth/password/change/", form)
      return data
    },
    onSuccess: () => {
      showToast("Contraseña actualizada exitosamente")
      setForm({ current_password: "", password: "", password2: "" })
      setOpen(false)
      setError("")
    },
    onError: (e) => {
      setError(e?.response?.data?.error || e?.response?.data?.password?.[0] || "No se pudo cambiar la contraseña.")
    },
  })

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!form.current_password || !form.password) {
      setError("Por favor completa los campos requeridos.")
      return
    }
    if (form.password !== form.password2) {
      setError("Las contraseñas nuevas no coinciden.")
      return
    }
    setError("")
    mutation.mutate()
  }

  return (
    <div className="au-card" style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: open ? "16px" : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--admin-radius-md)",
              background: "var(--admin-surface-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--admin-primary-text)",
            }}
          >
            <KeyRound size={18} />
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--admin-primary-text)", margin: 0 }}>
              Seguridad
            </p>
            <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "2px 0 0" }}>
              Cambiar clave de acceso
            </p>
          </div>
        </div>
        {!open && (
          <SecondaryButton size="sm" onClick={() => setOpen(true)}>
            Modificar
          </SecondaryButton>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--admin-radius-md)",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#dc2626",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
              Contraseña actual
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={form.current_password}
              onChange={(e) => setForm((p) => ({ ...p, current_password: e.target.value }))}
              className="au-input"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
              Contraseña nueva
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="au-input"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
              Confirmar contraseña nueva
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password2}
              onChange={(e) => setForm((p) => ({ ...p, password2: e.target.value }))}
              className="au-input"
              placeholder="Repite la nueva contraseña"
              required
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => {
                setOpen(false)
                setError("")
              }}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Cancelar
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              size="sm"
              loading={mutation.isPending}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {mutation.isPending ? "Guardando..." : "Actualizar"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  )
}

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({
    first_name:       user?.first_name       || "",
    last_name:        user?.last_name        || "",
    phone:            user?.phone            || "",
    address_street:   user?.address_street   || "",
    address_comuna:   user?.address_comuna   || "",
    address_city:     user?.address_city     || "",
    address_province: user?.address_province || "",
  })
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch("/users/me/", form)
      return data
    },
    onSuccess: (data) => {
      setUser?.(data)
      setSaved(true)
      showToast("Perfil actualizado exitosamente")
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (e) => {
      const data = e?.response?.data
      const msg = data && typeof data === "object"
        ? Object.values(data).flat().join(" ")
        : "No se pudo guardar la información. Intenta nuevamente."
      showToast(msg, "error")
    },
  })

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }))

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"

  return (
    <div className="au-page" data-testid="dashboard-profile-page">
      <AdminPageHeader
        title="Mi perfil"
        description="Gestiona tu información personal, datos de despacho para compras y credenciales de seguridad."
        breadcrumb={[
          { label: "Mi cuenta", to: "/dashboard" },
          { label: "Perfil" },
        ]}
      />

      {/* 2-Column Responsive Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Identity Card & Security Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Identity Card */}
          <div
            className="au-card"
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "76px",
                height: "76px",
                borderRadius: "50%",
                background: "rgba(26, 255, 110, 0.12)",
                border: "2px solid rgba(26, 255, 110, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                fontWeight: 800,
                color: "#16a34a",
              }}
            >
              {initials}
            </div>

            <div>
              <p style={{ fontSize: "17px", fontWeight: 700, color: "var(--admin-primary-text)", margin: "0 0 4px" }}>
                {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Usuario LevelPro"}
              </p>
              <p style={{ fontSize: "13px", color: "var(--admin-muted-text)", margin: 0 }}>
                {user?.email || "Sin email registrado"}
              </p>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--admin-muted-text)",
                background: "var(--admin-surface-muted)",
                padding: "4px 12px",
                borderRadius: "var(--admin-radius-full)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <Shield size={12} style={{ color: "#16a34a" }} />
              {user?.is_staff || user?.is_superuser ? "Cuenta Staff / Admin" : "Cliente Verificado"}
            </div>
          </div>

          {/* Change Password Card */}
          <ChangePasswordSection />
        </div>

        {/* Right Column: Personal Data & Shipping Address Form */}
        <div className="au-card" style={{ padding: "24px" }}>
          <div style={{ marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--admin-card-border)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--admin-primary-text)", margin: 0 }}>
              Información de contacto y despacho
            </h3>
            <p style={{ fontSize: "12px", color: "var(--admin-muted-text)", margin: "4px 0 0" }}>
              Estos datos se usarán por defecto al calcular costos y procesar envíos de tus pedidos.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* First Name + Last Name */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={set("first_name")}
                  className="au-input"
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                  Apellido
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={set("last_name")}
                  className="au-input"
                  placeholder="Tu apellido"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                Teléfono de contacto
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                className="au-input"
                placeholder="+56 9 1234 5678"
              />
            </div>

            {/* Address Street */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                Dirección (Calle, número, depto/oficina)
              </label>
              <input
                type="text"
                value={form.address_street}
                onChange={set("address_street")}
                className="au-input"
                placeholder="Av. Providencia 1234, Depto 402"
              />
            </div>

            {/* Comuna + Ciudad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                  Comuna
                </label>
                <input
                  type="text"
                  value={form.address_comuna}
                  onChange={set("address_comuna")}
                  className="au-input"
                  placeholder="Providencia"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                  Ciudad
                </label>
                <input
                  type="text"
                  value={form.address_city}
                  onChange={set("address_city")}
                  className="au-input"
                  placeholder="Santiago"
                />
              </div>
            </div>

            {/* Region */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                Región
              </label>
              <input
                type="text"
                value={form.address_province}
                onChange={set("address_province")}
                className="au-input"
                placeholder="Región Metropolitana"
              />
            </div>

            {/* Read-only Email */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--admin-muted-text)", marginBottom: "6px" }}>
                Correo electrónico registrado
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="au-input"
                style={{ opacity: 0.65, cursor: "not-allowed", background: "var(--admin-surface-muted)" }}
              />
              <p style={{ fontSize: "11px", color: "var(--admin-muted-text)", margin: "4px 0 0" }}>
                El correo electrónico identifica tu cuenta y compras; comunícate con soporte si requieres transferirlo.
              </p>
            </div>

            {/* Action button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <PrimaryButton
                type="submit"
                loading={mutation.isPending}
                icon={saved ? <Check size={16} /> : <Save size={16} />}
              >
                {mutation.isPending ? "Guardando cambios..." : saved ? "¡Cambios guardados!" : "Guardar cambios"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
