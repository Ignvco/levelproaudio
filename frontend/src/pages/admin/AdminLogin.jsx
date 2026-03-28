// pages/admin/AdminLogin.jsx
// Login exclusivo para el panel admin — separado del login de usuarios

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import api from "../../api/client"
import { useAuthStore } from "../../store/authStore"
import iconImg from "../../assets/icon.png"

const schema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Requerido"),
})

export default function AdminLogin() {
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate               = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    setError("")
    try {
      const { data: tokens } = await api.post("/auth/login/", data)
      setTokens(tokens.access, tokens.refresh)
      const { data: profile } = await api.get("/auth/profile/")
      setUser(profile)

      if (!profile.is_staff && !profile.is_superuser) {
        setError("No tienes permisos para acceder al panel de administración.")
        useAuthStore.getState().logout()
        return
      }
      navigate("/admin")
    } catch {
      setError("Credenciales incorrectas.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "var(--bg)", fontFamily: "var(--font-sans)",
    }}>

      {/* Panel izquierdo — branding */}
      <div style={{
        width: "420px", flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "40px",
      }}
        className="hidden lg:flex"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src={iconImg} alt="" style={{ width: "28px",
            filter: "brightness(0) invert(1)" }} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>LevelPro Audio</span>
          <span style={{
            marginLeft: "4px", fontSize: "10px", fontWeight: 600,
            padding: "2px 7px", borderRadius: "100px",
            background: "var(--accent-glow)", color: "var(--accent)",
            border: "1px solid rgba(26,255,110,0.2)",
          }}>
            ADMIN
          </span>
        </div>

        <div>
          <h2 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.4rem", lineHeight: 1.1,
            marginBottom: "16px",
          }}>
            Panel de administración
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7 }}>
            Gestiona tu tienda, academia, servicios y analytics desde un solo lugar.
          </p>
        </div>

        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
          © 2026 LevelPro Audio Platform
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{
        flex: 1, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>

          {/* Mobile logo */}
          <div className="lg:hidden" style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "40px",
          }}>
            <img src={iconImg} alt="" style={{ width: "24px",
              filter: "brightness(0) invert(1)" }} />
            <span style={{ fontSize: "14px", fontWeight: 500 }}>LevelPro Admin</span>
          </div>

          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2rem", marginBottom: "8px",
          }}>
            Bienvenido
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "32px" }}>
            Ingresa con tus credenciales de administrador.
          </p>

          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)",
              border: "1px solid rgba(255,59,59,0.2)",
              color: "var(--danger)", fontSize: "13px", marginBottom: "20px",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "8px" }}>
                Email
              </label>
              <input type="email" {...register("email")}
                placeholder="admin@levelproaudio.com"
                className={`input ${errors.email ? "error" : ""}`}
              />
              {errors.email && (
                <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "8px" }}>
                Contraseña
              </label>
              <input type="password" {...register("password")}
                placeholder="••••••••"
                className={`input ${errors.password ? "error" : ""}`}
              />
            </div>

            <button type="submit" disabled={loading}
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center",
                marginTop: "8px", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Verificando..." : "Ingresar al panel"}
            </button>
          </form>

          <div style={{
            marginTop: "32px", paddingTop: "24px",
            borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "center",
          }}>
            <a href="/" style={{ fontSize: "13px", color: "var(--text-3)",
              transition: "color var(--dur)" }}
              className="hover:text-[var(--text-2)]">
              ← Ver sitio web
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}