// pages/Login.jsx
import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { useAuthStore } from "../store/authStore"
import AuthShell, { AuthField, AuthSubmit } from "../components/auth/AuthShell"
import Seo from "../components/Seo"

export default function Login() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  const { login } = useAuthStore()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const next            = searchParams.get("next") || "/"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await login(email, password)
      const currentUser = useAuthStore.getState().user
      navigate(currentUser?.is_staff || currentUser?.is_superuser ? "/admin" : next)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        "Email o contraseña incorrectos."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <Seo title="Iniciar sesión" noindex />
    <AuthShell
      eyebrow="· Bienvenido de vuelta"
      title="Iniciá sesión"
      subtitle="Ingresá a tu cuenta para seguir comprando, aprender y participar."
      footer={<>¿No tenés cuenta?{" "}
        <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>Registrate gratis</Link>
      </>}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && (
          <div data-testid="login-error" style={{ padding: "12px 16px", borderRadius: "14px",
            background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
            color: "var(--danger)", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <AuthField label="Email" testId="login-email" type="email" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
          required autoComplete="email" autoFocus />

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "9px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>Contraseña</label>
            <Link to="/forgot-password" style={{ fontSize: "12px", color: "var(--text-3)", textDecoration: "none" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <AuthField label="" testId="login-password" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            required autoComplete="current-password" />
        </div>

        <AuthSubmit loading={loading}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
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
