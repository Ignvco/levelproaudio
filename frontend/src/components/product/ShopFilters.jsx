// components/product/ShopFilters.jsx — Panel de filtros (sidebar desktop + drawer mobile)
import { useState, useEffect } from "react"
import { Check, X, SlidersHorizontal } from "lucide-react"
import { mediaUrl } from "../../utils/mediaUrl"

const money = (v) => `$${Number(v).toLocaleString("es-CL")}`

function Section({ title, children }) {
  return (
    <div style={{ paddingBlock: "22px", borderBottom: "1px solid var(--border)" }}>
      <p style={{
        fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "var(--text-3)", marginBottom: "16px",
      }}>{title}</p>
      {children}
    </div>
  )
}

function RowButton({ active, onClick, testid, leading, count, children }) {
  return (
    <button data-testid={testid} onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "10px",
        padding: "8px 12px", borderRadius: "var(--r-full)", cursor: "pointer",
        fontSize: "13.5px", fontWeight: active ? 600 : 500, textAlign: "left",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#000" : "var(--text-2)",
        border: active ? "1px solid var(--accent)" : "1px solid transparent",
        transition: "background 180ms var(--ease), color 180ms var(--ease)",
        fontFamily: "var(--font-sans)",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "var(--text)" } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)" } }}>
      {leading}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
      {count != null && (
        <span style={{ fontSize: "11.5px", fontWeight: 600,
          color: active ? "rgba(0,0,0,0.55)" : "var(--text-3)",
          background: active ? "rgba(0,0,0,0.12)" : "var(--surface-3)",
          minWidth: "22px", height: "20px", borderRadius: "9999px", padding: "0 7px",
          display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {count}
        </span>
      )}
      {active && <Check size={15} strokeWidth={2.6} />}
    </button>
  )
}

function BrandLogo({ brand, active }) {
  const logo = brand.logo ? mediaUrl(brand.logo) : null
  const initials = brand.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span style={{ width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
      background: logo ? "#fff" : (active ? "rgba(0,0,0,0.15)" : "var(--surface-3)"),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "10px", fontWeight: 800, overflow: "hidden",
      color: active ? "#000" : "var(--text-2)", padding: logo ? "4px" : 0 }}>
      {logo
        ? <img src={logo} alt={brand.name} style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={e => { e.target.style.display = "none" }} />
        : initials}
    </span>
  )
}

function Toggle({ checked, onChange, label, testid }) {
  return (
    <button data-testid={testid} onClick={() => onChange(!checked)}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 2px", cursor: "pointer", background: "transparent", border: "none",
        fontSize: "13.5px", color: "var(--text-2)", fontFamily: "var(--font-sans)",
      }}>
      <span>{label}</span>
      <span style={{
        width: "40px", height: "22px", borderRadius: "9999px", flexShrink: 0,
        background: checked ? "var(--accent)" : "var(--surface-3)",
        border: "1px solid " + (checked ? "var(--accent)" : "var(--border)"),
        position: "relative", transition: "background 200ms var(--ease)",
      }}>
        <span style={{
          position: "absolute", top: "2px", left: checked ? "20px" : "2px",
          width: "16px", height: "16px", borderRadius: "50%",
          background: checked ? "#000" : "var(--text-3)",
          transition: "left 200ms var(--ease)",
        }} />
      </span>
    </button>
  )
}

export default function ShopFilters({
  categories, brands, values, onSet, onClear, activeCount, hideHeader = false,
}) {
  const [priceMin, setPriceMin] = useState(values.price_min || "")
  const [priceMax, setPriceMax] = useState(values.price_max || "")

  useEffect(() => { setPriceMin(values.price_min || ""); setPriceMax(values.price_max || "") },
    [values.price_min, values.price_max])

  const applyPrice = () => onSet({ price_min: priceMin || null, price_max: priceMax || null })

  return (
    <div>
      {!hideHeader && (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: "4px",
      }}>
        <p style={{ display: "inline-flex", alignItems: "center", gap: "8px",
          fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
          <SlidersHorizontal size={15} /> Filtros
        </p>
        {activeCount > 0 && (
          <button data-testid="clear-filters" onClick={onClear}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "12px", color: "var(--accent)", background: "transparent",
              border: "none", cursor: "pointer", fontWeight: 600 }}>
            <X size={13} /> Limpiar ({activeCount})
          </button>
        )}
      </div>
      )}

      <Section title="Categorías">
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <RowButton active={!values.category} testid="filter-cat-all"
            onClick={() => onSet({ category: null })}>Todas</RowButton>
          {categories.map(cat => (
            <RowButton key={cat.id} active={values.category === cat.slug}
              testid={`filter-cat-${cat.slug}`} count={cat.product_count}
              onClick={() => onSet({ category: values.category === cat.slug ? null : cat.slug })}>
              {cat.name}
            </RowButton>
          ))}
        </div>
      </Section>

      <Section title="Marcas">
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <RowButton active={!values.brand} testid="filter-brand-all"
            onClick={() => onSet({ brand: null })}>Todas las marcas</RowButton>
          {brands.map(b => (
            <RowButton key={b.id} active={values.brand === b.slug}
              testid={`filter-brand-${b.slug}`} count={b.product_count}
              leading={<BrandLogo brand={b} active={values.brand === b.slug} />}
              onClick={() => onSet({ brand: values.brand === b.slug ? null : b.slug })}>
              {b.name}
            </RowButton>
          ))}
        </div>
      </Section>

      <Section title="Precio">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <input type="number" inputMode="numeric" value={priceMin} data-testid="filter-price-min"
            onChange={e => setPriceMin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyPrice()}
            placeholder="Mín" className="input" style={{ padding: "10px 12px", fontSize: "13px" }} />
          <span style={{ color: "var(--text-3)" }}>–</span>
          <input type="number" inputMode="numeric" value={priceMax} data-testid="filter-price-max"
            onChange={e => setPriceMax(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyPrice()}
            placeholder="Máx" className="input" style={{ padding: "10px 12px", fontSize: "13px" }} />
        </div>
        <button data-testid="filter-price-apply" onClick={applyPrice}
          className="btn btn-dark" style={{ width: "100%", padding: "9px", fontSize: "13px" }}>
          Aplicar precio
        </button>
      </Section>

      <Section title="Disponibilidad">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Toggle testid="filter-instock" label="Solo en stock"
            checked={values.in_stock === "true"}
            onChange={v => onSet({ in_stock: v ? "true" : null })} />
          <Toggle testid="filter-onsale" label="En oferta"
            checked={values.on_sale === "true"}
            onChange={v => onSet({ on_sale: v ? "true" : null })} />
        </div>
      </Section>
    </div>
  )
}

export { money }
