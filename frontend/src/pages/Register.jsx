// pages/Register.jsx

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "react-router-dom"
import api from "../api/client"
import { useAuthStore } from "../store/authStore"
import iconImg from "../assets/icon.png"

const schema = z.object({
  first_name: z.string().min(1, "Requerido"),
  last_name:  z.string().optional(),
  email:      z.string().email("Email inválido"),
  username:   z.string().min(3, "Mínimo 3 caracteres"),
  password:   z.string().min(8, "Mínimo 8 caracteres"),
  password2:  z.string(),
}).refine(d => d.password === d.password2, {
  message: "Las contraseñas no coinciden",
  path: ["password2"],
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
      await api.post("/auth/register/", data)
      const { data: tokens } = await api.post("/auth/login/", {
        email: data.email, password: data.password,
      })
      setTokens(tokens.access, tokens.refresh)
      const { data: profile } = await api.get("/auth/profile/")
      setUser(profile)
      navigate("/dashboard")
    } catch (err) {
      const d = err.response?.data
      setError(d?.email?.[0] || d?.username?.[0] || d?.detail || "Error al crear la cuenta.")
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    [
      { name: "first_name", label: "Nombre",   type: "text", half: true },
      { name: "last_name",  label: "Apellido", type: "text", half: true },
    ],
    [{ name: "email",    label: "Email",    type: "email" }],
    [{ name: "username", label: "Usuario",  type: "text",  placeholder: "ej: levelprousuario" }],
    [{ name: "password",  label: "Contraseña",          type: "password", placeholder: "Mínimo 8 caracteres" }],
    [{ name: "password2", label: "Confirmar contraseña", type: "password", placeholder: "Repite la contraseña" }],
  ]

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "40px 24px", background: "var(--bg)",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Link to="/" style={{ display: "inline-flex", justifyContent: "center" }}>
            <img src={iconImg} alt="" style={{ width: "32px", filter: "brightness(0) invert(1)" }} />
          </Link>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem",
            marginTop: "16px", marginBottom: "8px" }}>
            Crear cuenta
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-2)" }}>
            Únete a LevelPro Audio
          </p>
        </div>

        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "32px",
        }}>
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)",
              color: "var(--danger)", fontSize: "13px", marginBottom: "20px",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Nombre + Apellido */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { name: "first_name", label: "Nombre" },
                { name: "last_name",  label: "Apellido" },
              ].map(({ name, label }) => (
                <div key={name}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                    color: "var(--text-2)", marginBottom: "6px" }}>
                    {label}
                  </label>
                  <input {...register(name)}
                    className={`input ${errors[name] ? "error" : ""}`} />
                  {errors[name] && (
                    <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "3px" }}>
                      {errors[name].message}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Resto de campos */}
            {[
              { name: "email",     label: "Email",                type: "email" },
              { name: "username",  label: "Usuario",              type: "text",     placeholder: "ej: levelprousuario" },
              { name: "password",  label: "Contraseña",           type: "password", placeholder: "Mínimo 8 caracteres" },
              { name: "password2", label: "Confirmar contraseña", type: "password" },
            ].map(({ name, label, type, placeholder }) => (
              <div key={name}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
                  color: "var(--text-2)", marginBottom: "6px" }}>
                  {label}
                </label>
                <input type={type} {...register(name)} placeholder={placeholder || ""}
                  className={`input ${errors[name] ? "error" : ""}`} />
                {errors[name] && (
                  <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "3px" }}>
                    {errors[name].message}
                  </p>
                )}
              </div>
            ))}

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
            <Link to="/login" style={{ color: "var(--text-2)", transition: "color var(--dur)" }}
              className="hover:text-white">
              Ingresar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}