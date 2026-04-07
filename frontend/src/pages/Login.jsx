// pages/Login.jsx — versión corregida completa
import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useAuthStore } from "../store/authStore"

export default function Login() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  // ← Desestructura todo lo que necesitas FUERA del handler
  const { login, user } = useAuthStore()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const next            = searchParams.get("next") || "/"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await login(email, password)
      // ← Lee el estado actual del store directamente
      const currentUser = useAuthStore.getState().user
      navigate(currentUser?.is_staff || currentUser?.is_superuser
        ? "/admin" : next)
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
            <img src="/src/assets/logo.png" alt="LevelPro"
              style={{ height: "32px", margin: "0 auto 24px" }} />
          </Link>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
            fontWeight: 300, marginBottom: "8px" }}>
            Bienvenido de vuelta
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "14px" }}>
            Ingresá a tu cuenta para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

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

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "8px" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="tu@email.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "8px" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-accent"
            style={{ justifyContent: "center", fontSize: "15px",
              padding: "14px", marginTop: "4px",
              opacity: loading ? 0.7 : 1 }}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "14px", color: "var(--text-3)" }}>
          ¿No tenés cuenta?{" "}
          <Link to="/register"
            style={{ color: "var(--accent)", fontWeight: 500 }}>
            Registrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}