// pages/dashboard/Profile.jsx
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useAuthStore } from "../../store/authStore"
import api from "../../api/client"
import { showToast } from "../../components/ui/ToastNotification"

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const [form, setForm]   = useState({
    first_name:       user?.first_name       || "",
    last_name:        user?.last_name        || "",
    phone:            user?.phone            || "",
    address_street:   user?.address_street   || "",
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

  const inputSt = {
    width: "100%", padding: "12px 16px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)",
    fontSize: "14px", outline: "none",
    transition: "border-color var(--dur)",
  }

  const fields = [
    { key: "first_name",       label: "Nombre",          col: 1 },
    { key: "last_name",        label: "Apellido",         col: 1 },
    { key: "phone",            label: "Teléfono",         col: 2 },
    { key: "address_street",   label: "Dirección",        col: 2 },
    { key: "address_city",     label: "Ciudad",           col: 1 },
    { key: "address_province", label: "Región",           col: 1 },
  ]

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "600px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
          Mi cuenta
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300,
          letterSpacing: "-0.02em" }}>
          Mi perfil
        </h1>
      </div>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px",
        marginBottom: "32px", padding: "24px",
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

      {/* Formulario */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Nombre + Apellido */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          {fields.filter(f => f.col === 1).map(({ key, label }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "8px" }}>
                {label}
              </label>
              <input value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                style={inputSt}
                onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"} />
            </div>
          ))}
        </div>

        {/* Teléfono + Dirección */}
        {fields.filter(f => f.col === 2).map(({ key, label }) => (
          <div key={key}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "8px" }}>
              {label}
            </label>
            <input value={form[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              style={inputSt}
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
        ))}

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