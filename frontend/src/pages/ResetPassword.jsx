// pages/ResetPassword.jsx — Setear nueva contraseña con uid + token
import { useState } from "react"
import { Link, useSearchParams, useNavigate } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import api from "../api/client"
import AuthShell, { AuthField, AuthSubmit } from "../components/auth/AuthShell"

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const uid   = params.get("uid") || ""
  const token = params.get("token") || ""

  const [password, setPassword]   = useState("")
  const [password2, setPassword2] = useState("")
  const [done, setDone]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  const invalidLink = !uid || !token

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (password !== password2) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    try {
      await api.post("/auth/password/reset/confirm/", { uid, token, password, password2 })
      setDone(true)
      setTimeout(() => navigate("/login"), 2500)
    } catch (err) {
      const data = err?.response?.data
      setError(
        data?.detail ||
        data?.password?.[0] ||
        "El enlace no es válido o expiró. Solicitá uno nuevo."
      )
    } finally {
      setLoading(false)
    }
  }

  if (invalidLink) {
    return (
      <AuthShell
        eyebrow="· Enlace inválido"
        title="Algo salió mal"
        subtitle="El enlace de recuperación está incompleto o es inválido. Solicitá uno nuevo."
        footer={<Link to="/forgot-password" style={{ color: "var(--accent)", fontWeight: 600 }}>Solicitar nuevo enlace</Link>}
      >
        <div />
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="· Listo"
        title="Contraseña actualizada"
        subtitle="Tu contraseña se cambió con éxito. Te estamos redirigiendo al inicio de sesión…"
        footer={<Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Ir a iniciar sesión</Link>}
      >
        <div data-testid="reset-done-box" style={{ display: "flex", alignItems: "center", gap: "14px",
          padding: "18px 20px", borderRadius: "16px",
          background: "rgba(26,255,110,0.06)", border: "1px solid rgba(26,255,110,0.22)" }}>
          <span style={{ color: "var(--accent)" }}><CheckCircle2 size={26} strokeWidth={2.2} /></span>
          <p style={{ color: "var(--text)", fontSize: "14.5px", fontWeight: 600 }}>
            ¡Todo listo! Ya podés iniciar sesión con tu nueva contraseña.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="· Nueva contraseña"
      title="Restablecé tu contraseña"
      subtitle="Elegí una nueva contraseña segura para tu cuenta."
      footer={<>¿Recordaste tu contraseña?{" "}
        <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Iniciá sesión</Link>
      </>}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && (
          <div data-testid="reset-error" style={{ padding: "12px 16px", borderRadius: "14px",
            background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
            color: "var(--danger)", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <AuthField label="Nueva contraseña" testId="reset-password" type="password" value={password}
          onChange={e => setPassword(e.target.value)} placeholder="••••••••"
          required autoComplete="new-password" autoFocus />

        <AuthField label="Repetí la contraseña" testId="reset-password2" type="password" value={password2}
          onChange={e => setPassword2(e.target.value)} placeholder="••••••••"
          required autoComplete="new-password" />

        <AuthSubmit loading={loading}>
          {loading ? "Guardando..." : "Cambiar contraseña"}
        </AuthSubmit>
      </form>
    </AuthShell>
  )
}
