// pages/dashboard/Profile.jsx

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "../../store/authStore"
import api from "../../api/client"

const schema = z.object({
  first_name:       z.string().min(1, "Requerido"),
  last_name:        z.string().optional(),
  phone:            z.string().optional(),
  address_street:   z.string().optional(),
  address_city:     z.string().optional(),
  address_province: z.string().optional(),
})

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
        color: "var(--text-2)", marginBottom: "8px", letterSpacing: "0.02em" }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>{error}</p>}
    </div>
  )
}

export default function Profile() {
  const { user, setUser }  = useAuthStore()
  const queryClient        = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name:       user?.first_name || "",
      last_name:        user?.last_name  || "",
      phone:            user?.phone      || "",
      address_street:   user?.address_street   || "",
      address_city:     user?.address_city     || "",
      address_province: user?.address_province || "",
    },
  })

  useEffect(() => { if (user) reset(user) }, [user, reset])

  const mutation = useMutation({
    mutationFn: data => api.patch("/auth/profile/", data),
    onSuccess: ({ data }) => { setUser(data); queryClient.invalidateQueries(["profile"]) },
  })

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "560px" }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 2.8rem)",
        marginBottom: "40px" }}>
        Mi perfil
      </h1>

      <form onSubmit={handleSubmit(data => mutation.mutate(data))}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "28px", display: "flex",
          flexDirection: "column", gap: "20px" }}>

          {/* Email — solo lectura */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "8px" }}>Email</label>
            <input value={user?.email || ""} disabled
              className="input" style={{ opacity: 0.5, cursor: "not-allowed" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" error={errors.first_name?.message}>
              <input {...register("first_name")} className={`input ${errors.first_name ? "error" : ""}`} />
            </Field>
            <Field label="Apellido">
              <input {...register("last_name")} className="input" />
            </Field>
          </div>

          <Field label="Teléfono">
            <input {...register("phone")} className="input" />
          </Field>

          <div style={{ paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
              Dirección de envío
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Field label="Calle y número">
                <input {...register("address_street")} className="input"
                  placeholder="Ej: Av. Providencia 1234" />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Ciudad">
                  <input {...register("address_city")} className="input" />
                </Field>
                <Field label="Región">
                  <input {...register("address_province")} className="input" />
                </Field>
              </div>
            </div>
          </div>

          {mutation.isSuccess && (
            <p style={{ fontSize: "13px", color: "var(--accent)" }}>✓ Perfil actualizado.</p>
          )}
          {mutation.isError && (
            <p style={{ fontSize: "13px", color: "var(--danger)" }}>Error al guardar.</p>
          )}

          <button type="submit" disabled={!isDirty || mutation.isPending}
            className="btn btn-accent"
            style={{ justifyContent: "center", opacity: (!isDirty || mutation.isPending) ? 0.5 : 1 }}>
            {mutation.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  )
}