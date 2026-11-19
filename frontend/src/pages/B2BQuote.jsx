// pages/B2BQuote.jsx — Solicitud pública de cotización B2B mayorista e institucional (V3.3)
import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Building2, CheckCircle2, Plus, Trash2, Search, ShieldCheck,
  AlertCircle, FileText, ArrowRight, Package,
} from "lucide-react"
import Seo from "../components/Seo"
import Button from "../components/ui/Button"
import { getProducts } from "../api/products.api"
import { createB2BQuote } from "../api/b2b.api"
import { validateTaxId } from "../api/shipping.api"
import { usePrice } from "../hooks/usePrice"
import { useAuthStore } from "../store/authStore"
import { showToast } from "../utils/toast"

const CARD = {
  background: "#121212",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "22px",
  padding: "clamp(20px, 3vw, 28px)",
}

const INPUT = {
  width: "100%",
  background: "#0c0c0c",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  padding: "11px 14px",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
}

const LABEL = {
  display: "block",
  fontSize: "11.5px",
  fontWeight: 600,
  color: "var(--text-2)",
  marginBottom: "6px",
  letterSpacing: "0.03em",
}

export default function B2BQuote() {
  const { user } = useAuthStore()
  const { currency: globalCurrency, format } = usePrice()

  const [currency, setCurrency] = useState(globalCurrency || "CLP")
  const [country, setCountry] = useState(globalCurrency === "ARS" ? "AR" : "CL")
  const [form, setForm] = useState({
    company_name: "",
    tax_id: "",
    contact_name: user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "",
    email: user?.email || "",
    phone: user?.phone || "",
    notes: "",
  })
  const [taxCheck, setTaxCheck] = useState(null) // { is_valid, formatted, type }
  const [search, setSearch] = useState("")
  const [selectedItems, setSelectedItems] = useState([]) // [{ product, quantity }]
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [createdQuote, setCreatedQuote] = useState(null)

  const { data: catalogData } = useQuery({
    queryKey: ["b2b-catalog", search],
    queryFn: () => getProducts({ search: search || undefined, page_size: 20 }),
  })
  const catalogProducts = catalogData?.results || catalogData || []

  const handleValidateTax = async () => {
    const raw = form.tax_id.trim()
    if (!raw) { setTaxCheck(null); return }
    try {
      const res = await validateTaxId({ country, tax_id: raw })
      setTaxCheck(res)
      if (res.is_valid && res.formatted) {
        setForm(p => ({ ...p, tax_id: res.formatted }))
      }
    } catch {
      setTaxCheck(null)
    }
  }

  const addProduct = (product) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQty = (productId, qty) => {
    const n = Math.max(1, Number(qty) || 1)
    setSelectedItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: n } : i))
  }

  const removeProduct = (productId) => {
    setSelectedItems(prev => prev.filter(i => i.product.id !== productId))
  }

  const unitPriceFor = (product) => {
    const p = product?.prices?.[currency]
    return Number(p != null ? p : (product?.price || 0))
  }

  const subtotal = selectedItems.reduce((acc, i) => acc + unitPriceFor(i.product) * i.quantity, 0)
  const taxAmount = currency === "CLP" ? Math.round(subtotal * 0.19) : 0
  const total = subtotal + taxAmount

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!form.company_name.trim() || !form.tax_id.trim() || !form.contact_name.trim() || !form.email.trim()) {
      setError("Completa razón social, RUT/CUIT, contacto y email.")
      return
    }
    if (!selectedItems.length) {
      setError("Agrega al menos un equipo del catálogo a tu cotización.")
      return
    }
    setSubmitting(true)
    try {
      const res = await createB2BQuote({
        company_name: form.company_name.trim(),
        tax_id: form.tax_id.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        currency,
        notes: form.notes.trim(),
        items: selectedItems.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      })
      setCreatedQuote(res)
      showToast("Cotización B2B registrada correctamente")
    } catch (err) {
      setError(err?.response?.data?.error || "No pudimos enviar la cotización. Verifica los datos.")
    } finally {
      setSubmitting(false)
    }
  }

  if (createdQuote) {
    return (
      <div className="lp-container" style={{ paddingTop: "clamp(110px, 14vw, 150px)", paddingBottom: "96px", maxWidth: "680px" }}>
        <Seo title="Cotización B2B Recibida" description="Tu solicitud mayorista fue registrada en LevelPro Audio." />
        <div data-testid="b2b-quote-success" style={{ ...CARD, textAlign: "center", borderColor: "rgba(26,255,110,0.35)" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%", margin: "0 auto 18px",
            background: "rgba(26,255,110,0.12)", border: "1px solid rgba(26,255,110,0.35)",
            display: "grid", placeItems: "center", color: "var(--accent)",
          }}>
            <CheckCircle2 size={30} />
          </div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "8px" }}>
            Cotización B2B #{String(createdQuote.id).slice(0, 8).toUpperCase()}
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, color: "#fff", marginBottom: "12px" }}>
            ¡Solicitud recibida!
          </h1>
          <p style={{ fontSize: "14.5px", color: "var(--text-2)", lineHeight: 1.65, marginBottom: "24px" }}>
            Registramos la cotización para <strong>{createdQuote.company_name}</strong> ({createdQuote.tax_id}) por un total referencial de{" "}
            <strong style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
              {format(createdQuote.total, createdQuote.currency)} {createdQuote.currency}
            </strong>. Nuestro equipo comercial aplicará descuentos por volumen y te responderá en menos de 24 horas hábiles.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Button variant="green" onClick={() => { setCreatedQuote(null); setSelectedItems([]) }}>
              Nueva cotización
            </Button>
            <Link to="/shop" style={{
              padding: "12px 22px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.14)",
              color: "#fff", textDecoration: "none", fontSize: "13.5px", fontWeight: 600,
            }}>
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingTop: "clamp(100px, 12vw, 132px)", paddingBottom: "96px" }}>
      <Seo
        title="Cotizaciones B2B y Empresas"
        description="Cotizaciones mayoristas e institucionales de audio profesional para estudios, canales, productoras y universidades en Chile y Argentina."
      />
      <div className="lp-container">
        {/* Hero editorial */}
        <div style={{ marginBottom: "36px", maxWidth: "780px" }}>
          <p style={{
            fontSize: "11px", fontWeight: 700, color: "var(--accent)",
            textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: "10px",
            display: "inline-flex", alignItems: "center", gap: "6px",
          }}>
            <Building2 size={14} /> Empresas, Estudios e Instituciones · B2B
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4.2vw, 3.1rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.08, marginBottom: "14px" }}>
            Cotizaciones mayoristas con factura y precios congelados.
          </h1>
          <p style={{ fontSize: "15.5px", color: "var(--text-2)", lineHeight: 1.65 }}>
            Equipamos estudios de grabación, canales, teatros, iglesias y universidades en Chile (Factura Electrónica SII) y Argentina (Factura A/B AFIP). Seleccioná tu equipamiento y recibí una propuesta formal con descuento por volumen.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)", gap: "24px", alignItems: "start" }} className="b2b-grid">
          {/* Columna izquierda: Datos fiscales + Selector de equipos */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={CARD}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={17} style={{ color: "var(--accent)" }} /> 1. Datos de empresa y facturación
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={LABEL}>País de facturación</label>
                  <select
                    value={country}
                    onChange={e => {
                      const c = e.target.value
                      setCountry(c)
                      setTaxCheck(null)
                      if (c === "CL" && currency === "ARS") setCurrency("CLP")
                      if (c === "AR" && currency === "CLP") setCurrency("ARS")
                    }}
                    style={INPUT}
                  >
                    <option value="CL">Chile (SII · RUT)</option>
                    <option value="AR">Argentina (AFIP · CUIT)</option>
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Moneda de la propuesta</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} style={INPUT}>
                    <option value="CLP">CLP — Peso chileno</option>
                    <option value="USD">USD — Dólar estadounidense</option>
                    <option value="ARS">ARS — Peso argentino</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={LABEL}>Razón social / Estudio *</label>
                  <input
                    required
                    value={form.company_name}
                    onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
                    placeholder="Ej: Estudios del Sur SpA"
                    style={INPUT}
                  />
                </div>
                <div>
                  <label style={LABEL}>{country === "CL" ? "RUT Empresa *" : "CUIT Empresa *"}</label>
                  <input
                    required
                    value={form.tax_id}
                    onChange={e => { setForm(p => ({ ...p, tax_id: e.target.value })); setTaxCheck(null) }}
                    onBlur={handleValidateTax}
                    placeholder={country === "CL" ? "76.123.456-0" : "30-71890123-1"}
                    style={{
                      ...INPUT,
                      borderColor: taxCheck
                        ? (taxCheck.is_valid ? "rgba(26,255,110,0.55)" : "rgba(239,68,68,0.6)")
                        : "rgba(255,255,255,0.12)",
                    }}
                  />
                  {taxCheck && (
                    <p style={{ fontSize: "11px", marginTop: "5px", color: taxCheck.is_valid ? "var(--accent)" : "var(--danger)" }}>
                      {taxCheck.is_valid ? `✓ ${taxCheck.type} válido (${taxCheck.formatted})` : `${taxCheck.type} con dígito verificador inválido`}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={LABEL}>Persona de contacto *</label>
                  <input
                    required
                    value={form.contact_name}
                    onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
                    placeholder="Nombre y apellido"
                    style={INPUT}
                  />
                </div>
                <div>
                  <label style={LABEL}>Email corporativo *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="compras@estudio.cl"
                    style={INPUT}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "14px" }}>
                <div>
                  <label style={LABEL}>Teléfono / WhatsApp</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+56 9 1234 5678"
                    style={INPUT}
                  />
                </div>
                <div>
                  <label style={LABEL}>Notas del proyecto o plazos requeridos</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Ej: Despacho en Providencia, licitación institucional, requerimos instalación..."
                    style={{ ...INPUT, resize: "vertical" }}
                  />
                </div>
              </div>
            </div>

            {/* Selector de productos */}
            <div style={CARD}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Package size={17} style={{ color: "var(--accent)" }} /> 2. Seleccionar equipamiento del catálogo
              </h2>

              <div style={{ position: "relative", marginBottom: "14px" }}>
                <Search size={15} style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar micrófonos, interfaces, monitores, consolas..."
                  style={{ ...INPUT, paddingLeft: "38px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                {catalogProducts.map(prod => (
                  <div
                    key={prod.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                      padding: "10px 14px", borderRadius: "12px", background: "#181818",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "13.5px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {prod.name}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                        {format(unitPriceFor(prod), currency)} · {prod.brand_name || prod.category_name || "Pro Audio"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProduct(prod)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0,
                        background: "rgba(26,255,110,0.12)", border: "1px solid rgba(26,255,110,0.3)",
                        color: "var(--accent)", borderRadius: "999px", padding: "6px 12px",
                        fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      <Plus size={13} /> Agregar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Columna derecha: Resumen de cotización */}
          <div style={{ ...CARD, position: "sticky", top: "96px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "16px" }}>
              Resumen de propuesta ({currency})
            </h2>

            {selectedItems.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-3)", padding: "24px 0", textAlign: "center", borderTop: "1px dashed rgba(255,255,255,0.1)", borderBottom: "1px dashed rgba(255,255,255,0.1)" }}>
                Agregá equipos desde el buscador para calcular el presupuesto mayorista.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                {selectedItems.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                      padding: "10px 12px", borderRadius: "12px", background: "#181818",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {product.name}
                      </p>
                      <p style={{ fontSize: "11.5px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                        {format(unitPriceFor(product), currency)} c/u
                      </p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={quantity}
                      onChange={e => updateQty(product.id, e.target.value)}
                      aria-label={`Cantidad para ${product.name}`}
                      style={{
                        width: "58px", textAlign: "center", background: "#0b0b0b",
                        border: "1px solid rgba(255,255,255,0.14)", borderRadius: "8px",
                        color: "#fff", padding: "5px", fontSize: "13px", fontFamily: "var(--font-mono)",
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Quitar ${product.name}`}
                      onClick={() => removeProduct(product.id)}
                      style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "13.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
                <span>Subtotal neto</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{format(subtotal, currency)}</span>
              </div>
              {currency === "CLP" && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
                  <span>IVA referencial (19%)</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{format(taxAmount, currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "17px", fontWeight: 800, color: "#fff", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <span>Total estimado</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                  {format(total, currency)} {currency}
                </span>
              </div>
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "10px", marginBottom: "14px",
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5", fontSize: "12.5px",
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            <Button
              type="submit"
              variant="green"
              size="md"
              disabled={submitting || selectedItems.length === 0}
              loading={submitting}
              style={{ width: "100%", justifyContent: "center", gap: "8px" }}
            >
              {submitting ? "Enviando cotización..." : "Solicitar cotización formal"}
              {!submitting && <ArrowRight size={15} />}
            </Button>

            <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-3)", marginTop: "12px", justifyContent: "center" }}>
              <ShieldCheck size={14} style={{ color: "var(--accent)" }} /> Sin compromiso de compra · Descuentos por volumen
            </p>
          </div>
        </form>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .b2b-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
