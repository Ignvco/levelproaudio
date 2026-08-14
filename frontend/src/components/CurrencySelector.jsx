// components/CurrencySelector.jsx — selector de país/moneda en el header.
import { useState, useRef, useEffect } from "react"
import { useCurrencyStore, CURRENCIES } from "../store/currencyStore"

export default function CurrencySelector() {
  const currency = useCurrencyStore(s => s.currency)
  const setCurrency = useCurrencyStore(s => s.setCurrency)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const active = CURRENCIES[currency] || CURRENCIES.CLP

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Cambiar moneda"
        style={{ display: "flex", alignItems: "center", gap: "6px",
          height: "36px", padding: "0 12px", borderRadius: "18px",
          background: "transparent", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: 600,
          transition: "background 180ms var(--ease), color 180ms var(--ease)" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff" }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.75)" }}>
        <span style={{ fontSize: "15px" }}>{active.flag}</span>
        <span>{active.code}</span>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "44px", right: 0, zIndex: 100,
          minWidth: "190px", background: "#161616", borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          <p style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.1em",
            padding: "12px 14px 6px" }}>
            Moneda
          </p>
          {Object.values(CURRENCIES).map(c => (
            <button key={c.code}
              onClick={() => { setCurrency(c.code); setOpen(false) }}
              style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%",
                padding: "10px 14px", cursor: "pointer", border: "none", textAlign: "left",
                background: c.code === currency ? "rgba(26,255,110,0.08)" : "transparent",
                color: c.code === currency ? "var(--accent)" : "var(--text)", fontSize: "13px" }}
              onMouseEnter={e => { if (c.code !== currency) e.currentTarget.style.background = "rgba(255,255,255,0.04)" }}
              onMouseLeave={e => { if (c.code !== currency) e.currentTarget.style.background = "transparent" }}>
              <span style={{ fontSize: "16px" }}>{c.flag}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              <span style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
