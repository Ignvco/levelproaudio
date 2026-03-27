// pages/NotFound.jsx

import { Link } from "react-router-dom"
import iconImg from "../assets/icon.png"

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px", textAlign: "center",
      background: "var(--bg)",
    }}>
      <img src={iconImg} alt="" style={{
        width: "48px", marginBottom: "32px",
        filter: "brightness(0) invert(0.15)",
      }} />

      <p style={{ fontFamily: "var(--font-serif)", fontSize: "6rem",
        lineHeight: 1, color: "var(--surface-3)", fontWeight: 400, marginBottom: "4px" }}>
        404
      </p>

      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
        marginBottom: "16px" }}>
        Página no encontrada
      </h1>
      <p style={{ fontSize: "15px", color: "var(--text-2)", maxWidth: "360px",
        lineHeight: 1.7, marginBottom: "36px" }}>
        La página que buscas no existe o fue movida.
      </p>

      <div style={{ display: "flex", gap: "12px" }}>
        <Link to="/" className="btn btn-accent">Volver al inicio</Link>
        <Link to="/shop" className="btn btn-ghost">Ver tienda</Link>
      </div>
    </div>
  )
}