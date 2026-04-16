// pages/Register.jsx
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import logo from "../assets/logo.png"

export default function Register() {
  const [form, setForm]     = useState({
    first_name: "", last_name: "",
    email: "", password: "", password2: "",
  })
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)
  const { register }        = useAuthStore()
  const navigate            = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.password2) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await register(form)
      navigate("/")
    } catch (err) {
      const data = err?.response?.data
      setError(
        data?.email?.[0] ||
        data?.password?.[0] ||
        data?.detail ||
        "Error al registrarse."
      )
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key: "first_name", label: "Nombre",          type: "text",     placeholder: "Juan"          },
    { key: "last_name",  label: "Apellido",         type: "text",     placeholder: "García"        },
    { key: "email",      label: "Email",            type: "email",    placeholder: "tu@email.com"  },
    { key: "password",   label: "Contraseña",       type: "password", placeholder: "Mínimo 8 caracteres" },
    { key: "password2",  label: "Repetir contraseña",type: "password",placeholder: "••••••••"     },
  ]

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "clamp(24px, 5vw, 60px)",
      background: `radial-gradient(ellipse 60% 60% at 50% 30%,
        rgba(26,255,110,0.05) 0%, transparent 70%)`,
    }}>
      <div style={{
        width: "100%", maxWidth: "420px",
        display: "flex", flexDirection: "column", gap: "32px",
      }}
        className="animate-fade-up"
      >
        <div style={{ textAlign: "center" }}>
          <Link to="/">
            <img src={logo} alt="LevelPro"
              style={{ height: "32px", margin: "0 auto 24px" }} />
          </Link>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
            fontWeight: 300, marginBottom: "8px" }}>
            Crear cuenta
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "14px" }}>
            Únete a la comunidad de LevelPro Audio
          </p>
        </div>

        <form onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)",
              border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "14px",
            }}>
              {error}
            </div>
          )}

          {fields.map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "8px" }}>
                {label}
              </label>
              <input type={type} value={form[key]} placeholder={placeholder}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="input" required />
            </div>
          ))}

          <button type="submit" disabled={loading}
            className="btn btn-accent"
            style={{ justifyContent: "center", fontSize: "15px",
              padding: "14px", marginTop: "4px",
              opacity: loading ? 0.7 : 1 }}>
            {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "14px", color: "var(--text-3)" }}>
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 500 }}>
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}