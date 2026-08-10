// pages/admin/AdminSettings.jsx — Panel de personalización del sitio
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminSiteSettings, updateSiteSettings } from "../../api/siteSettings.api"
import { mediaUrl } from "../../utils/mediaUrl"

const TABS = [
  { id: "hero",     label: "Hero"        },
  { id: "pillars",  label: "Pilares"     },
  { id: "brand",    label: "Marca"       },
  { id: "contact",  label: "Contacto"    },
  { id: "sections", label: "Secciones"   },
  { id: "seo",      label: "SEO"         },
  { id: "test",     label: "Testimonial" },
]

const inputSt = {
  width: "100%", padding: "10px 14px",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: "var(--r-md)", color: "var(--text)",
  fontSize: "13px", outline: "none",
  fontFamily: "var(--font-sans)",
  transition: "border-color 150ms",
}

const labelSt = {
  display: "block", fontSize: "11px", color: "var(--text-3)",
  textTransform: "uppercase", letterSpacing: "0.1em",
  marginBottom: "8px", fontWeight: 600,
}

function Field({ label, children, helper }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={labelSt}>{label}</label>
      {children}
      {helper && (
        <p style={{ fontSize: "11px", color: "var(--text-3)",
          marginTop: "6px", lineHeight: 1.5 }}>{helper}</p>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 16px",
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: "var(--r-md)", cursor: "pointer",
      transition: "border-color 150ms",
    }}>
      <span style={{ fontSize: "13px", color: "var(--text)",
        fontFamily: "var(--font-sans)" }}>{label}</span>
      <span style={{
        position: "relative", width: "38px", height: "22px",
        borderRadius: "11px",
        background: checked ? "var(--accent)" : "var(--surface-3)",
        transition: "background 200ms",
      }}>
        <input type="checkbox" checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%",
            cursor: "pointer" }} />
        <span style={{
          position: "absolute",
          top: "2px", left: checked ? "18px" : "2px",
          width: "18px", height: "18px", borderRadius: "50%",
          background: "#fff",
          transition: "left 200ms var(--ease)",
        }} />
      </span>
    </label>
  )
}

function FileInput({ value, onChange, previewUrl }) {
  const [preview, setPreview] = useState(previewUrl)
  useEffect(() => { setPreview(previewUrl) }, [previewUrl])
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {preview && (
        <div style={{
          width: "70px", height: "70px", borderRadius: "var(--r-md)",
          overflow: "hidden", background: "var(--surface-2)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <img src={mediaUrl(preview)} alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
      )}
      <label style={{
        flex: 1, padding: "10px 14px",
        background: "var(--surface-2)", border: "1px dashed var(--border)",
        borderRadius: "var(--r-md)", cursor: "pointer",
        fontSize: "12px", color: "var(--text-2)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        transition: "border-color 150ms",
      }}>
        <input type="file" accept="image/*"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) {
              onChange(f)
              setPreview(URL.createObjectURL(f))
            }
          }}
          style={{ display: "none" }} />
        {value?.name || "Elegir imagen…"}
      </label>
    </div>
  )
}

export default function AdminSettings() {
  const qc = useQueryClient()
  const [tab, setTab]     = useState("hero")
  const [form, setForm]   = useState(null)
  const [files, setFiles] = useState({})

  const { data } = useQuery({ queryKey: ["site-settings-admin"], queryFn: getAdminSiteSettings })
  useEffect(() => {
    if (data && !form) setForm({ ...data })
  }, [data, form])

  const save = useMutation({
    mutationFn: () => updateSiteSettings(cleanForPost(form), files),
    onSuccess: (fresh) => {
      qc.setQueryData(["site-settings-admin"], fresh)
      qc.invalidateQueries({ queryKey: ["site-settings"] })
      setForm({ ...fresh })
      setFiles({})
    },
    onError: (err) => {
      const status = err?.response?.status
      if (status === 413) {
        alert("La imagen es demasiado grande. Reducila a menos de 25 MB e intentalo de nuevo.\n\nTip: si es una foto de Adobe Stock 4K, exportala como JPEG de 1920×1080 (queda debajo de 500 KB).")
      } else {
        alert("Error al guardar. Revisá la conexión e intentalo de nuevo.")
      }
    },
  })

  function cleanForPost(f) {
    if (!f) return {}
    const clone = { ...f }
    // Removemos URLs derivadas del serializer read-only
    ;["hero_image_url","hero_image_2_url","hero_image_3_url",
      "pillar_shop_image_url","pillar_academy_image_url","pillar_services_image_url",
      "logo_url","og_image_url","testimonial_photo_url",
      "id","created_at","updated_at"].forEach(k => delete clone[k])
    return clone
  }

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }
  function setFile(k, f) { setFiles(prev => ({ ...prev, [k]: f })) }

  if (!form) {
    return <div style={{ padding: "40px", color: "var(--text-2)" }}>Cargando…</div>
  }

  return (
    <div style={{ padding: "clamp(20px, 3vw, 40px)",
      maxWidth: "980px", margin: "0 auto" }} data-testid="admin-settings">

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", flexWrap: "wrap", gap: "16px",
        marginBottom: "32px" }}>
        <div>
          <p style={{ fontSize: "11px", color: "var(--accent-text)",
            textTransform: "uppercase", letterSpacing: "0.15em",
            fontWeight: 700, marginBottom: "10px",
            display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }} />
            Personalización
          </p>
          <h1 className="display-bold" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)",
            fontWeight: 700, letterSpacing: "-0.03em",
            color: "var(--admin-page-text)", lineHeight: 1,
          }}>
            Configurá tu sitio
          </h1>
        </div>
        <button
          data-testid="save-settings"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          style={{
            padding: "11px 22px", borderRadius: "var(--r-full)",
            background: "var(--accent)", color: "#000",
            fontSize: "13px", fontWeight: 700, border: "none",
            cursor: save.isPending ? "wait" : "pointer",
            fontFamily: "var(--font-sans)",
            opacity: save.isPending ? 0.6 : 1,
            boxShadow: "0 8px 24px rgba(26,255,110,0.25)",
          }}>
          {save.isPending ? "Guardando…" : save.isSuccess ? "✓ Guardado" : "Guardar cambios"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", overflowX: "auto",
        marginBottom: "24px", padding: "4px",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-full)" }}>
        {TABS.map(t => (
          <button key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 16px", borderRadius: "var(--r-full)",
              background: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "#000" : "var(--text-2)",
              fontSize: "12px", fontWeight: 600,
              border: "none", cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "all 150ms",
              whiteSpace: "nowrap",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        padding: "clamp(20px, 3vw, 32px)" }}>

        {tab === "hero" && (
          <>
            <Field label="Título grande del hero">
              <input style={inputSt} value={form.hero_title || ""}
                onChange={e => set("hero_title", e.target.value)}
                data-testid="hero-title-input" />
            </Field>
            <Field label="Descripción bajo el título">
              <textarea style={{ ...inputSt, minHeight: "80px", resize: "vertical" }}
                value={form.hero_subtitle || ""}
                onChange={e => set("hero_subtitle", e.target.value)} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <Field label="Texto botón 1">
                <input style={inputSt} value={form.hero_cta1_text || ""}
                  onChange={e => set("hero_cta1_text", e.target.value)} />
              </Field>
              <Field label="Link botón 1">
                <input style={inputSt} value={form.hero_cta1_link || ""}
                  onChange={e => set("hero_cta1_link", e.target.value)} />
              </Field>
              <Field label="Texto botón 2">
                <input style={inputSt} value={form.hero_cta2_text || ""}
                  onChange={e => set("hero_cta2_text", e.target.value)} />
              </Field>
              <Field label="Link botón 2">
                <input style={inputSt} value={form.hero_cta2_link || ""}
                  onChange={e => set("hero_cta2_link", e.target.value)} />
              </Field>
            </div>
            <Field label="Imagen del hero 1 (opcional)"
              helper="Se muestra de fondo detrás del texto. Recomendado: 1600×900px.">
              <FileInput value={files.hero_image}
                previewUrl={form.hero_image_url}
                onChange={f => setFile("hero_image", f)} />
            </Field>
            <Field label="Imagen del hero 2 (opcional)"
              helper="Si cargás 2 o 3 imágenes, el hero las rota automáticamente con un fundido.">
              <FileInput value={files.hero_image_2}
                previewUrl={form.hero_image_2_url}
                onChange={f => setFile("hero_image_2", f)} />
            </Field>
            <Field label="Imagen del hero 3 (opcional)"
              helper="Tercera imagen del carrusel del hero.">
              <FileInput value={files.hero_image_3}
                previewUrl={form.hero_image_3_url}
                onChange={f => setFile("hero_image_3", f)} />
            </Field>
          </>
        )}

        {tab === "pillars" && (
          <>
            <p style={{ fontSize: "13px", color: "var(--text-2)",
              lineHeight: 1.6, marginBottom: "20px" }}>
              Imágenes de fondo de las 3 cards de la sección <strong>“Todo lo que necesitás”</strong>.
              El texto se muestra encima con un degradado para que sea legible.
              Recomendado: 1200×750px (horizontal).
            </p>
            <Field label="Fondo · Tienda"
              helper="Se muestra de fondo en la card 'Tienda'.">
              <FileInput value={files.pillar_shop_image}
                previewUrl={form.pillar_shop_image_url}
                onChange={f => setFile("pillar_shop_image", f)} />
            </Field>
            <Field label="Fondo · Academia"
              helper="Se muestra de fondo en la card 'Academia'.">
              <FileInput value={files.pillar_academy_image}
                previewUrl={form.pillar_academy_image_url}
                onChange={f => setFile("pillar_academy_image", f)} />
            </Field>
            <Field label="Fondo · Servicios"
              helper="Se muestra de fondo en la card 'Servicios'.">
              <FileInput value={files.pillar_services_image}
                previewUrl={form.pillar_services_image_url}
                onChange={f => setFile("pillar_services_image", f)} />
            </Field>
          </>
        )}

        {tab === "brand" && (
          <>
            <Field label="Nombre del sitio">
              <input style={inputSt} value={form.site_name || ""}
                onChange={e => set("site_name", e.target.value)} />
            </Field>
            <Field label="Tagline">
              <input style={inputSt} value={form.tagline || ""}
                onChange={e => set("tagline", e.target.value)} />
            </Field>
            <Field label="Logo del sitio" helper="Se muestra en el navbar. Recomendado: PNG transparente 200×60.">
              <FileInput value={files.logo}
                previewUrl={form.logo_url}
                onChange={f => setFile("logo", f)} />
            </Field>
            <Field label="Color de acento" helper="Verde por defecto. Cambia hover states, badges y CTAs.">
              <input type="color" value={form.accent_color || "#1aff6e"}
                onChange={e => set("accent_color", e.target.value)}
                style={{ width: "60px", height: "40px", border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)", cursor: "pointer",
                  background: "var(--surface-2)" }} />
            </Field>
          </>
        )}

        {tab === "contact" && (
          <>
            <Field label="WhatsApp"
              helper={
                form.contact_whatsapp && !/^\+\d{8,15}$/.test(form.contact_whatsapp)
                  ? "⚠️ Formato raro — debería ser +código país y número, solo dígitos. Ej: +5492622635045. Así como está, el botón de WhatsApp puede quedar roto en todo el sitio."
                  : "Formato internacional con +. Ej: +5492622635045"
              }>
              <input style={{
                  ...inputSt,
                  borderColor: form.contact_whatsapp && !/^\+\d{8,15}$/.test(form.contact_whatsapp)
                    ? "#D97706" : inputSt.borderColor,
                }}
                value={form.contact_whatsapp || ""}
                onChange={e => set("contact_whatsapp", e.target.value)} />
            </Field>
            <Field label="Usuario Instagram" helper="Sin @. Ej: levelproar">
              <input style={inputSt} value={form.contact_instagram || ""}
                onChange={e => set("contact_instagram", e.target.value)} />
            </Field>
            <Field label="Email de contacto">
              <input type="email" style={inputSt} value={form.contact_email || ""}
                onChange={e => set("contact_email", e.target.value)} />
            </Field>
          </>
        )}

        {tab === "sections" && (
          <div style={{ display: "grid", gap: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "8px" }}>
              Activá o desactivá qué secciones aparecen en la Home:
            </p>
            <Toggle label="Métricas (Trust strip)"    checked={!!form.show_trust_strip} onChange={v => set("show_trust_strip", v)} />
            <Toggle label="3 pilares (Tienda / Academia / Servicios)" checked={!!form.show_pillars} onChange={v => set("show_pillars", v)} />
            <Toggle label="Productos destacados"     checked={!!form.show_products}    onChange={v => set("show_products", v)} />
            <Toggle label="Cursos destacados"        checked={!!form.show_courses}     onChange={v => set("show_courses", v)} />
            <Toggle label="Servicios destacados"     checked={!!form.show_services}    onChange={v => set("show_services", v)} />
            <Toggle label="Conoce LevelPro"          checked={!!form.show_about}       onChange={v => set("show_about", v)} />
            <div style={{ margin: "8px 0 16px 0", paddingLeft: "2px" }}>
              <Field label="Título — Conoce LevelPro">
                <input style={inputSt} value={form.about_title || ""}
                  onChange={e => set("about_title", e.target.value)}
                  placeholder="No vendemos audio por vender." />
              </Field>
              <Field label="Texto — Conoce LevelPro">
                <textarea style={{ ...inputSt, minHeight: "80px" }}
                  value={form.about_body || ""}
                  onChange={e => set("about_body", e.target.value)}
                  placeholder="Creemos que comprar equipamiento profesional debería..." />
              </Field>
            </div>
            <Toggle label="Testimonial destacado"    checked={!!form.show_testimonial} onChange={v => set("show_testimonial", v)} />
            <Toggle label="Marcas partner (marquee)" checked={!!form.show_brands}      onChange={v => set("show_brands", v)} />
            <Toggle label="CTA final"                checked={!!form.show_final_cta}   onChange={v => set("show_final_cta", v)} />
          </div>
        )}

        {tab === "seo" && (
          <>
            <Field label="Meta título" helper="Aparece como título en Google. Máx 70 chars.">
              <input style={inputSt} maxLength={70} value={form.seo_title || ""}
                onChange={e => set("seo_title", e.target.value)} />
            </Field>
            <Field label="Meta descripción" helper="Aparece bajo el título en resultados de Google. Máx 170 chars.">
              <textarea style={{ ...inputSt, minHeight: "80px" }} maxLength={170}
                value={form.seo_description || ""}
                onChange={e => set("seo_description", e.target.value)} />
            </Field>
            <Field label="Imagen OG" helper="Se muestra cuando comparten tu link en redes. 1200×630px.">
              <FileInput value={files.og_image}
                previewUrl={form.og_image_url}
                onChange={f => setFile("og_image", f)} />
            </Field>
          </>
        )}

        {tab === "test" && (
          <>
            <Field label="Foto del cliente">
              <FileInput value={files.testimonial_photo}
                previewUrl={form.testimonial_photo_url}
                onChange={f => setFile("testimonial_photo", f)} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <Field label="Nombre">
                <input style={inputSt} value={form.testimonial_name || ""}
                  onChange={e => set("testimonial_name", e.target.value)} />
              </Field>
              <Field label="Cargo · ciudad">
                <input style={inputSt} value={form.testimonial_role || ""}
                  onChange={e => set("testimonial_role", e.target.value)} />
              </Field>
            </div>
            <Field label="Quote">
              <textarea style={{ ...inputSt, minHeight: "100px" }}
                value={form.testimonial_quote || ""}
                onChange={e => set("testimonial_quote", e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </div>
  )
}
