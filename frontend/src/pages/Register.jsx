// pages/Register.jsx
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { useAuthStore } from "../store/authStore"
import AuthShell, { AuthField, AuthSubmit } from "../components/auth/AuthShell"
import AcceptCheckbox from "../components/legal/AcceptCheckbox"
import Seo from "../components/Seo"

export default function Register() {
  const [form, setForm]     = useState({
    first_name: "", last_name: "",
    email: "", password: "", password2: "",
  })
  const [accepted, setAccepted] = useState(false)
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)
  const { register }        = useAuthStore()
  const navigate            = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!accepted) {
      setError("Debés aceptar los Términos y la Política de Privacidad para continuar.")
      return
    }
    if (form.password !== form.password2) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const username = form.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") + Math.floor(Math.random() * 9000 + 1000)
      await register({ ...form, username })
      navigate("/")
    } catch (err) {
      const data = err?.response?.data
      setError(
        data?.email?.[0] ||
        data?.username?.[0] ||
        data?.password?.[0] ||
        data?.detail ||
        "Error al registrarse."
      )
    } finally {
      setLoading(false)
    }
  }

  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }))

  return (
    <>
    <Seo title="Crear cuenta" noindex />
    <AuthShell
      eyebrow="· Sumate gratis"
      title="Crear cuenta"
      subtitle="Unite a la comunidad LevelPro Audio y accedé a la tienda, la academia y los sorteos."
      footer={<>¿Ya tenés cuenta?{" "}
        <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Iniciar sesión</Link>
      </>}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && (
          <div data-testid="register-error" style={{ padding: "12px 16px", borderRadius: "14px",
            background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
            color: "var(--danger)", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <AuthField label="Nombre" testId="register-first-name" type="text" value={form.first_name}
            onChange={set("first_name")} placeholder="Juan" required />
          <AuthField label="Apellido" testId="register-last-name" type="text" value={form.last_name}
            onChange={set("last_name")} placeholder="García" required />
        </div>

        <AuthField label="Email" testId="register-email" type="email" value={form.email}
          onChange={set("email")} placeholder="tu@email.com" required autoComplete="email" />

        <AuthField label="Contraseña" testId="register-password" type="password" value={form.password}
          onChange={set("password")} placeholder="Mínimo 8 caracteres" required autoComplete="new-password" />

        <AuthField label="Repetir contraseña" testId="register-password2" type="password" value={form.password2}
          onChange={set("password2")} placeholder="••••••••" required autoComplete="new-password" />

        <div style={{ marginTop: "4px" }}>
          <AcceptCheckbox checked={accepted} onChange={setAccepted} testId="register-accept-terms">
            Acepto los{" "}
            <Link to="/terminos" target="_blank" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Términos y Condiciones
            </Link>{" "}
            y la{" "}
            <Link to="/privacidad" target="_blank" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Política de Privacidad
            </Link>.
          </AcceptCheckbox>
        </div>

        <AuthSubmit loading={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
          {!loading && (
            <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#000",
              color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowRight size={13} strokeWidth={2.5} />
            </span>
          )}
        </AuthSubmit>
      </form>
    </AuthShell>
    </>
  )
}
