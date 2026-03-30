// pages/Register.jsx

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate, Link } from "react-router-dom"
import api from "../api/client"
import { useAuthStore } from "../store/authStore"
import iconImg from "../assets/icon.png"

const schema = z.object({
  first_name: z.string().min(1, "Requerido"),
  last_name:  z.string().optional(),
  email:      z.string().email("Email inválido"),
  password:   z.string().min(8, "Mínimo 8 caracteres"),
  confirm:    z.string(),
}).refine(d => d.password === d.confirm, {
  message: "Las contraseñas no coinciden",
  path: ["confirm"],
})

export default function Register() {
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
      // Registra
      await api.post("/auth/register/", {
        first_name: data.first_name,
        last_name:  data.last_name || "",
        email:      data.email,
        username:   data.email,
        password:   data.password,
        password2:  data.confirm,
        phone:      "",
      })
      // Login automático
      const { data: tokens } = await api.post("/auth/login/", {
        email:    data.email,
        password: data.password,
      })
      setTokens(tokens.access, tokens.refresh)
      const { data: profile } = await api.get("/auth/profile/")
      setUser(profile)
      navigate("/dashboard")
    } catch (e) {
      const errData = e.response?.data
    if (errData?.email)     setError(`Email: ${errData.email[0]}`)
    else if (errData?.password)  setError(`Contraseña: ${errData.password[0]}`)
    else if (errData?.password2) setError(`Contraseña: ${errData.password2[0]}`)
    else if (errData?.username)  setError(`Usuario: ${errData.username[0]}`)
    else if (typeof errData === "object") setError(JSON.stringify(errData))
    else setError("Error al crear la cuenta.")
  } finally {
    setLoading(false)
    }
  }

  const inputSt = (hasError) => ({
    width: "100%", padding: "12px 16px",
    background: "var(--surface-2)",
    border: `1px solid ${hasError ? "var(--danger)" : "var(--border)"}`,
    borderRadius: "var(--r-md)", color: "var(--text)",
    fontFamily: "var(--font-sans)", fontSize: "14px", outline: "none",
  })

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px", background: "var(--bg)",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Link to="/" style={{ display: "inline-flex",
            alignItems: "center", justifyContent: "center" }}>
            <img src={iconImg} alt="" style={{
              width: "32px", filter: "brightness(0) invert(1)",
            }} />
          </Link>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
            marginTop: "16px", marginBottom: "8px" }}>
            Crear cuenta
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-2)" }}>
            Únete a LevelPro Audio
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "32px",
        }}>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px",
                  color: "var(--text-2)", marginBottom: "7px", fontWeight: 500 }}>
                  Nombre <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <input {...register("first_name")}
                  style={inputSt(errors.first_name)}
                  placeholder="Juan" />
                {errors.first_name && (
                  <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                    {errors.first_name.message}
                  </p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px",
                  color: "var(--text-2)", marginBottom: "7px", fontWeight: 500 }}>
                  Apellido
                </label>
                <input {...register("last_name")}
                  style={inputSt(false)} placeholder="García" />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px",
                color: "var(--text-2)", marginBottom: "7px", fontWeight: 500 }}>
                Email <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <input type="email" {...register("email")}
                style={inputSt(errors.email)} placeholder="tu@email.com" />
              {errors.email && (
                <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px",
                color: "var(--text-2)", marginBottom: "7px", fontWeight: 500 }}>
                Contraseña <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <input type="password" {...register("password")}
                style={inputSt(errors.password)} placeholder="Mínimo 8 caracteres" />
              {errors.password && (
                <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px",
                color: "var(--text-2)", marginBottom: "7px", fontWeight: 500 }}>
                Confirmar contraseña <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <input type="password" {...register("confirm")}
                style={inputSt(errors.confirm)} placeholder="Repite tu contraseña" />
              {errors.confirm && (
                <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                  {errors.confirm.message}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center",
                marginTop: "8px", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "13px",
            color: "var(--text-3)", marginTop: "20px" }}>
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" style={{ color: "var(--text-2)",
              transition: "color var(--dur)" }}
              className="hover:text-white">
              Ingresar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}