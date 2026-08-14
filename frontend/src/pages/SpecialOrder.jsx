// pages/SpecialOrder.jsx — Solicitar equipo bajo pedido
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { PackageSearch, Check, ArrowRight } from "lucide-react"
import { createSpecialOrder } from "../api/products.api"
import Seo from "../components/Seo"

const inputStyle = {
  width: "100%", padding: "13px 16px", borderRadius: "var(--r-lg)",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  color: "var(--text)", fontSize: "14px", outline: "none",
}

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 600,
        color: "var(--text-2)", marginBottom: "7px" }}>
        {label} {required && <span style={{ color: "var(--accent)" }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export default function SpecialOrder() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", equipment: "",
    brand_model: "", quantity: 1, details: "", budget: "",
  })
  const [error, setError] = useState("")

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form }
      if (!payload.budget) delete payload.budget
      return createSpecialOrder(payload)
    },
    onError: () => setError("No pudimos enviar tu solicitud. Revisá los datos e intentá de nuevo."),
  })

  const submit = () => {
    setError("")
    if (!form.name || !form.email || !form.equipment) {
      setError("Completá tu nombre, email y qué equipo buscás.")
      return
    }
    mutation.mutate()
  }

  if (mutation.isSuccess) {
    return (
      <>
        <Seo title="Solicitud enviada — LevelPro" />
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "64px", height: "64px", borderRadius: "50%", marginBottom: "24px",
            background: "rgba(26,255,110,0.12)", color: "var(--accent)" }}>
            <Check size={30} />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: "12px" }}>
            ¡Solicitud recibida!
          </h1>
          <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
            Gracias {form.name.split(" ")[0]}. Recibimos tu pedido de <strong>{form.equipment}</strong> y
            nuestro equipo te va a contactar a la brevedad para cotizarlo.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Seo title="Solicitar equipo bajo pedido — LevelPro"
        description="¿Buscás un equipo que no está en nuestro catálogo? Contanos qué necesitás y lo conseguimos para vos." />

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "clamp(40px, 6vw, 72px) 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "56px", height: "56px", borderRadius: "var(--r-xl)", marginBottom: "20px",
            background: "rgba(26,255,110,0.1)", color: "var(--accent)" }}>
            <PackageSearch size={26} />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
            marginBottom: "12px", letterSpacing: "-0.02em" }}>
            Solicitar equipo bajo pedido
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "15px", lineHeight: 1.6, maxWidth: "480px", margin: "0 auto" }}>
            ¿Buscás algo que no está en nuestro catálogo? Contanos qué necesitás y
            lo conseguimos para vos. Te cotizamos sin compromiso.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Field label="Nombre" required>
              <input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} />
            </Field>
            <Field label="Email" required>
              <input type="email" style={inputStyle} value={form.email} onChange={e => set("email", e.target.value)} />
            </Field>
          </div>

          <Field label="Teléfono / WhatsApp">
            <input style={inputStyle} value={form.phone} onChange={e => set("phone", e.target.value)}
              placeholder="Para contactarte más rápido" />
          </Field>

          <Field label="¿Qué equipo buscás?" required>
            <input style={inputStyle} value={form.equipment} onChange={e => set("equipment", e.target.value)}
              placeholder="Ej: Consola digital de 32 canales" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
            <Field label="Marca o modelo específico">
              <input style={inputStyle} value={form.brand_model} onChange={e => set("brand_model", e.target.value)}
                placeholder="Si lo sabés" />
            </Field>
            <Field label="Cantidad">
              <input type="number" min="1" style={inputStyle} value={form.quantity}
                onChange={e => set("quantity", Number(e.target.value))} />
            </Field>
          </div>

          <Field label="Detalles adicionales">
            <textarea style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
              value={form.details} onChange={e => set("details", e.target.value)}
              placeholder="Para qué lo vas a usar, especificaciones importantes, etc." />
          </Field>

          <Field label="Presupuesto aproximado (opcional)">
            <input type="number" style={inputStyle} value={form.budget}
              onChange={e => set("budget", e.target.value)}
              placeholder="En pesos, si tenés una idea" />
          </Field>

          {error && (
            <p style={{ color: "#ff6b6b", fontSize: "13px", padding: "10px 14px",
              background: "rgba(255,77,77,0.08)", borderRadius: "var(--r-md)",
              border: "1px solid rgba(255,77,77,0.2)" }}>
              {error}
            </p>
          )}

          <button onClick={submit} disabled={mutation.isPending}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
              padding: "15px 24px", borderRadius: "var(--r-lg)", cursor: "pointer",
              background: "var(--accent)", color: "#000", border: "none",
              fontSize: "15px", fontWeight: 700, marginTop: "8px",
              opacity: mutation.isPending ? 0.6 : 1 }}>
            {mutation.isPending ? "Enviando…" : "Enviar solicitud"}
            {!mutation.isPending && <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </>
  )
}
