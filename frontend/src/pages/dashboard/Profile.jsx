// pages/dashboard/Profile.jsx
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useAuthStore } from "../../store/authStore"
import api from "../../api/client"
import { showToast } from "../../components/ui/ToastNotification"

const inputSt = {
  width: "100%", padding: "12px 16px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "14px", outline: "none",
  transition: "border-color var(--dur)",
}

function Field({ label, value, onChange, type = "text", autoComplete }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
        color: "var(--text-2)", marginBottom: "8px" }}>
        {label}
      </label>
      <input value={value} type={type} autoComplete={autoComplete}
        onChange={onChange}
        style={inputSt}
        onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
        onBlur={e => e.target.style.borderColor = "var(--border)"} />
    </div>
  )
}

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
      showToast("Contraseña actualizada")
      setForm({ current_password: "", password: "", password2: "" })
      setOpen(false)
      setError("")
    },
    onError: (e) => {
      setError(e?.response?.data?.error || e?.response?.data?.password?.[0] || "No se pudo cambiar la contraseña.")
    },
  })

  const handleSubmit = () => {
    if (form.password !== form.password2) { setError("Las contraseñas nuevas no coinciden."); return }
    setError("")
    mutation.mutate()
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-2xl)", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: open ? "20px" : 0 }}>
        <div>
          <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text)" }}>Contraseña</p>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
            Cambiá tu contraseña de acceso.
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>
            Cambiar contraseña
          </button>
        )}
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>
              {error}
            </div>
          )}
          <Field label="Contraseña actual" type="password" autoComplete="current-password"
            value={form.current_password}
            onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))} />
          <Field label="Contraseña nueva" type="password" autoComplete="new-password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          <Field label="Repetir contraseña nueva" type="password" autoComplete="new-password"
            value={form.password2}
            onChange={e => setForm(p => ({ ...p, password2: e.target.value }))} />
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { setOpen(false); setError("") }} className="btn btn-ghost"
              style={{ padding: "10px 18px", fontSize: "13px", flex: 1 }}>
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={mutation.isPending}
              className="btn btn-accent"
              style={{ padding: "10px 18px", fontSize: "13px", flex: 1,
                opacity: mutation.isPending ? 0.7 : 1 }}>
              {mutation.isPending ? "Guardando..." : "Guardar contraseña"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const [form, setForm]   = useState({
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
      showToast("Perfil actualizado")
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "600px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
          Mi cuenta
        </p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)", fontWeight: 800,
          letterSpacing: "-0.03em" }}>
          Mi perfil
        </h1>
      </div>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px",
        marginBottom: "24px", padding: "24px",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)" }}>
        <div style={{
          width: "72px", height: "72px", borderRadius: "50%",
          background: "var(--accent-dim)", border: "2px solid var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "28px", fontWeight: 600, color: "var(--accent)",
          flexShrink: 0,
        }}>
          {user?.first_name?.[0]?.toUpperCase() || "U"}
        </div>
        <div>
          <p style={{ fontSize: "17px", fontWeight: 500, marginBottom: "4px" }}>
            {user?.first_name} {user?.last_name}
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            {user?.email}
          </p>
        </div>
      </div>

      {/* Cambio de contraseña */}
      <div style={{ marginBottom: "24px" }}>
        <ChangePasswordSection />
      </div>

      {/* Formulario de datos */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Nombre + Apellido */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="Nombre" value={form.first_name} onChange={set("first_name")} />
          <Field label="Apellido" value={form.last_name} onChange={set("last_name")} />
        </div>

        <Field label="Teléfono" value={form.phone} onChange={set("phone")} />
        <Field label="Dirección" value={form.address_street} onChange={set("address_street")} />

        {/* Comuna + Ciudad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Field label="Comuna" value={form.address_comuna} onChange={set("address_comuna")} />
          <Field label="Ciudad" value={form.address_city} onChange={set("address_city")} />
        </div>

        <Field label="Región" value={form.address_province} onChange={set("address_province")} />

        {/* Email — solo lectura */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
            color: "var(--text-2)", marginBottom: "8px" }}>
            Email
          </label>
          <input value={user?.email || ""} disabled
            style={{ ...inputSt, opacity: 0.5, cursor: "not-allowed" }} />
          <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "5px" }}>
            El email no se puede modificar.
          </p>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn btn-accent"
          style={{ justifyContent: "center", fontSize: "15px",
            padding: "14px", opacity: mutation.isPending ? 0.7 : 1 }}>
          {mutation.isPending ? "Guardando..."
            : saved ? "✓ Guardado" : "Guardar cambios"}
        </button>
      </div>
    </div>
  )
}
