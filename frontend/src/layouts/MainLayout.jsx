// layouts/MainLayout.jsx

import { useState, useRef, useEffect } from "react"
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "../store/authStore"
import { useCartStore } from "../store/cartStore"
import { getCategories } from "../api/products.api"
import logoImg from "../assets/logo.png"
import iconImg from "../assets/icon.png"
import api from "../api/client" 

// ── Dropdown Tienda ──────────────────────────────────────────
function ShopDropdown({ visible, onMouseEnter, onMouseLeave }) {
  const { data: catsData } = useQuery({
    queryKey: ["categories-nav"],
    queryFn:  getCategories,
    staleTime: 5 * 60 * 1000,
  })

  const all    = catsData?.results || catsData || []
  const getId  = (val) => (val && typeof val === "object" ? val.id : val)
  const roots  = all.filter(c => c.is_active && !getId(c.parent))
  const childCats = all.filter(c => c.is_active && !!getId(c.parent))

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed", top: "64px", left: 0,
        width: "100vw", zIndex: 999,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(-6px)",
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}>
      <div style={{
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "32px 0 36px",
      }}>
        <div style={{
          maxWidth: "var(--container)", margin: "0 auto",
          padding: "0 clamp(20px, 5vw, 60px)",
          display: "flex", gap: "0",
        }}>

          {/* Ver todo */}
          <div style={{ minWidth: "160px", paddingRight: "40px" }}>
            <Link to="/shop" style={{ textDecoration: "none" }}>
              <p style={{ fontSize: "13px", fontWeight: 500,
                color: "rgba(255,255,255,0.9)", marginBottom: "10px" }}
                className="hover:text-[var(--accent)]">
                Ver todo
              </p>
            </Link>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
              Catálogo completo
            </p>
          </div>

          {/* Separador */}
          <div style={{
            width: "1px", background: "rgba(255,255,255,0.07)",
            margin: "0 40px 0 0", alignSelf: "stretch",
          }} />

          {/* Columnas por categoría raíz */}
          <div style={{ display: "flex", gap: "0", flex: 1 }}>
            {roots.length === 0 ? (
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", alignSelf: "center" }}>
                Cargando...
              </p>
            ) : roots.map((cat, idx) => {
              const subs   = childCats.filter(c => getId(c.parent) === cat.id)
              const isLast = idx === roots.length - 1

              return (
                <div key={cat.id} style={{
                  flex: 1,
                  paddingRight: isLast ? 0 : "40px",
                  borderRight: isLast ? "none" : "1px solid rgba(255,255,255,0.07)",
                  marginRight: isLast ? 0 : "40px",
                }}>
                  <Link to={`/shop?category=${cat.slug}`} style={{ textDecoration: "none" }}>
                    <p style={{ fontSize: "13px", fontWeight: 500,
                      color: "rgba(255,255,255,0.9)", marginBottom: "12px" }}
                      className="hover:text-[var(--accent)]">
                      {cat.name}
                    </p>
                  </Link>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {subs.length === 0 ? (
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>—</p>
                    ) : subs.map(sub => (
                      <Link key={sub.id} to={`/shop?category=${sub.slug}`}
                        style={{ textDecoration: "none" }}>
                        <p style={{ fontSize: "12px",
                          color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}
                          className="hover:text-white">
                          {sub.name}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Acceso rápido */}
          <div style={{
            paddingLeft: "40px",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            minWidth: "160px",
            display: "flex", flexDirection: "column", gap: "10px",
          }}>
            <p style={{ fontSize: "11px", fontWeight: 500,
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: "4px" }}>
              Acceso rápido
            </p>
            {[
              { to: "/shop?is_featured=true", label: "Destacados" },
              { to: "/academy",               label: "Academia" },
              { to: "/services",              label: "Servicios" },
            ].map(({ to, label }) => (
              <Link key={to} to={to} style={{ textDecoration: "none" }}>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}
                  className="hover:text-white">
                  {label} →
                </p>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Navbar ─────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { isAuthenticated, user, logout } = useAuthStore()
  const cartCount = useCartStore(s => s.getCount())
  const navigate = useNavigate()
  const location = useLocation()

  const [shopOpen, setShopOpen] = useState(false)
  const shopTimer = useRef(null)



  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => { setShopOpen(false) }, [location.pathname])


  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const openShop = () => { clearTimeout(shopTimer.current); setShopOpen(true) }
  const closeShop = () => { shopTimer.current = setTimeout(() => setShopOpen(false), 120) }



  const links = [
    { to: "/shop", label: "Tienda" },
    { to: "/academy", label: "Academia" },
    { to: "/services", label: "Servicios" },
  ]

  return (
    <>
      {/* Overlay invisible — cierra al click fuera */}
      {shopOpen && (
        <div
          onClick={() => setShopOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 998 }}
        />
      )}

      {/* Dropdown — fuera del header para que no quede recortado */}
      <ShopDropdown
        visible={shopOpen}
        onMouseEnter={openShop}
        onMouseLeave={closeShop}
      />

      <header
        style={{
          position: "fixed",
          top: 0, left: 0, width: "100%",
          zIndex: 1000,
          transition: "all 0.35s cubic-bezier(.4,0,.2,1)",
          backdropFilter: scrolled ? "blur(18px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(18px)" : "none",
          background: scrolled ? "rgba(10,10,10,0.75)" : "transparent",
          borderBottom: scrolled
            ? "1px solid var(--border)"
            : "1px solid transparent",
        }}
      >
        <div className="container" style={{ maxWidth: "var(--container)" }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            height: "64px", gap: "24px",
          }}>

            {/* Logo */}
            <Link to="/" style={{
              display: "flex", alignItems: "center",
              gap: "10px", flexShrink: 0
            }}>
              <img src={logoImg} alt="LevelPro Audio"
                style={{
                  height: "45px", objectFit: "contain",
                  filter: "brightness(0) invert(1)", maxWidth: "130px",
                  display: window.innerWidth < 480 ? "none" : "block",
                }} />
            </Link>

            {/* Nav — desktop */}
            <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}
              className="hidden md:flex">

              {/* ── Tienda con dropdown ── */}
              <div
                onMouseEnter={openShop}
                onMouseLeave={closeShop}
                style={{ position: "relative" }}
              >
                <NavLink
                  to="/shop"
                  style={({ isActive }) => ({
                    padding: "8px 16px",
                    borderRadius: "100px",
                    fontSize: "14px", fontWeight: 400,
                    display: "flex", alignItems: "center", gap: "5px",
                    color: isActive || shopOpen
                      ? "var(--text)"
                      : scrolled ? "var(--text-2)" : "rgba(255,255,255,0.85)",
                    background: isActive || shopOpen
                      ? scrolled
                        ? "var(--surface-2)"
                        : "rgba(255,255,255,0.12)"
                      : "transparent",
                    backdropFilter: (isActive || shopOpen) && !scrolled
                      ? "blur(8px)" : "none",
                    transition: "all var(--dur) var(--ease)",
                    textDecoration: "none",
                  })}
                >
                  Tienda
                  {/* Chevron */}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                    style={{
                      transition: "transform 200ms ease",
                      transform: shopOpen ? "rotate(180deg)" : "rotate(0deg)",
                      opacity: 0.55,
                    }}>
                    <path d="M1 1L5 5L9 1" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round"
                      strokeLinejoin="round" />
                  </svg>
                </NavLink>
              </div>

              {/* Academia y Servicios — igual que antes */}
              {[
                { to: "/academy", label: "Academia" },
                { to: "/services", label: "Servicios" },
              ].map(({ to, label }) => (
                <NavLink
                  key={to} to={to}
                  style={({ isActive }) => ({
                    padding: "8px 16px",
                    borderRadius: "100px",
                    fontSize: "14px", fontWeight: 400,
                    color: isActive
                      ? "var(--text)"
                      : scrolled ? "var(--text-2)" : "rgba(255,255,255,0.85)",
                    background: isActive
                      ? scrolled ? "var(--surface-2)" : "rgba(255,255,255,0.12)"
                      : "transparent",
                    backdropFilter: isActive && !scrolled ? "blur(8px)" : "none",
                    transition: "all var(--dur) var(--ease)",
                    textDecoration: "none",
                  })}
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Acciones derechas — igual que tu código original */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

              {/* Carrito */}
              <Link to="/cart" style={{
                position: "relative", padding: "8px",
                color: "var(--text-2)", borderRadius: "100px",
                transition: "color var(--dur)", display: "flex",
              }} className="hover:text-white">
                <svg width="20" height="20" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <span style={{
                    position: "absolute", top: "2px", right: "2px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: "var(--accent)", color: "#000",
                    fontSize: "10px", fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </Link>

              {/* Auth — desktop */}
              <div className="hidden md:flex"
                style={{ alignItems: "center", gap: "8px" }}>
                {isAuthenticated ? (
                  <>
                    {/* Avatar sin texto "Cuenta" */}
                    <Link to="/dashboard" style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: "var(--surface-3)",
                      border: "1px solid var(--border)",
                      fontSize: "12px", fontWeight: 600, color: "var(--text)",
                      transition: "border-color var(--dur)",
                      textDecoration: "none",
                    }} className="hover:border-[var(--border-hover)]"
                      title={user?.first_name || user?.email}>
                      {(user?.first_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                    </Link>

                    {/* ADMIN */}
                    {(user?.is_staff || user?.is_superuser) && (
                      <Link to="/admin" style={{
                        padding: "7px 12px", borderRadius: "100px",
                        fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em",
                        background: "var(--accent-glow)",
                        color: "var(--accent)",
                        border: "1px solid rgba(26,255,110,0.25)",
                        transition: "all var(--dur) var(--ease)",
                        textDecoration: "none",
                      }} className="hidden md:inline-flex items-center">
                        ADMIN
                      </Link>
                    )}

                    <button
                      onClick={() => { logout(); navigate("/") }}
                      style={{
                        padding: "7px 14px", borderRadius: "100px",
                        fontSize: "13px", color: "var(--text-3)",
                        background: "none", border: "none",
                        cursor: "pointer", transition: "color var(--dur)",
                      }}
                      className="hover:text-[var(--text-2)]">
                      Salir
                    </button>
                  </>
                ) : (
                  <Link to="/login" className="btn btn-accent"
                    style={{ padding: "9px 20px", fontSize: "13px" }}>
                    Ingresar
                  </Link>
                )}
              </div>

              {/* Hamburger — mobile */}
              <button onClick={() => setOpen(!open)} className="md:hidden"
                style={{
                  padding: "8px", background: "none", border: "none",
                  cursor: "pointer", color: "var(--text-2)"
                }}
                aria-label="Menu">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  {open ? (
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu — igual que antes */}
        {open && (
          <div style={{
            background: "var(--surface)",
            borderTop: "1px solid var(--border)",
            padding: "16px 0 24px",
          }}>
            <div className="container" style={{ maxWidth: "var(--container)" }}>
              {[
                { to: "/shop", label: "Tienda" },
                { to: "/academy", label: "Academia" },
                { to: "/services", label: "Servicios" },
              ].map(({ to, label }) => (
                <NavLink key={to} to={to}
                  onClick={() => setOpen(false)}
                  style={({ isActive }) => ({
                    display: "block", padding: "12px 0", fontSize: "16px",
                    color: isActive ? "var(--text)" : "var(--text-2)",
                    borderBottom: "1px solid var(--border)",
                    textDecoration: "none",
                  })}>
                  {label}
                </NavLink>
              ))}
              <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
                {isAuthenticated ? (
                  <>
                    <Link to="/dashboard" className="btn btn-white"
                      style={{ flex: 1, justifyContent: "center", padding: "11px" }}
                      onClick={() => setOpen(false)}>
                      Mi cuenta
                    </Link>
                    <button onClick={() => { logout(); navigate("/"); setOpen(false) }}
                      className="btn btn-ghost" style={{ padding: "11px 20px" }}>
                      Salir
                    </button>
                  </>
                ) : (
                  <Link to="/login" className="btn btn-accent"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setOpen(false)}>
                    Ingresar
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  )
}


function FooterCategoryLinks() {
  const { data: catsData } = useQuery({
    queryKey: ["categories-nav"],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  })
  const cats = (catsData?.results || catsData || [])
    .filter(c => c.is_active)
    .slice(0, 6)

  return (
    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
      {cats.map(cat => (
        <li key={cat.id}>
          <Link
            to={`/shop?category=${cat.slug}`}
            style={{ fontSize: "14px", color: "var(--text-2)", transition: "color var(--dur)" }}
            className="hover:text-white"
          >
            {cat.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

// ── Footer ──────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      background: "var(--surface)",
      marginTop: "auto",
    }}>
      <div className="container" style={{ maxWidth: "var(--container)", padding: "60px clamp(20px, 5vw, 60px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "48px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-12"
        >
          {/* Brand */}
          <div>
            <img src={logoImg} alt="LevelPro Audio" style={{
              height: "18px",
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
              maxWidth: "150px",
              marginBottom: "16px",
            }} />
            <p style={{ fontSize: "14px", color: "var(--text-2)", maxWidth: "280px", lineHeight: 1.7 }}>
              Equipamiento profesional, academia online y producción musical en Chile y Argentina.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              {[
                {
                  href: "https://instagram.com/levelproar",
                  label: "Instagram",
                  path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
                },
                {
                  href: "https://wa.me/5492622635045",
                  label: "WhatsApp",
                  path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
                },
              ].map(({ href, label, path }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-3)",
                    transition: "all var(--dur) var(--ease)",
                  }}
                  className="hover:border-[var(--border-hover)] hover:text-[var(--text-2)]"
                >
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                    <path d={path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Tienda */}
          <div>
            <p style={{
              fontSize: "12px", fontWeight: 500, color: "var(--text-3)",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px"
            }}>
              Tienda
            </p>
            <FooterCategoryLinks />
          </div>

          {/* LevelPro */}
          <div>
            <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
              LevelPro
            </p>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Academia", to: "/academy" },
                { label: "Servicios", to: "/services" },
                { label: "Mi cuenta", to: "/dashboard" },
                { label: "Contacto", to: "/services" },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} style={{ fontSize: "14px", color: "var(--text-2)", transition: "color var(--dur)" }}
                    className="hover:text-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{
          marginTop: "48px",
          paddingTop: "24px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            © 2026 LevelPro Audio. Todos los derechos reservados.
          </p>
          <div style={{ display: "flex", gap: "20px", fontSize: "13px", color: "var(--text-3)" }}>
            <span>Chile & Argentina</span>
            <a href="https://wa.me/5492622635045" target="_blank" rel="noreferrer"
              style={{ transition: "color var(--dur)" }} className="hover:text-[var(--text-2)]"
            >
              +54 9 2622 63 5045
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function MainLayout({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <Footer />
    </div>
  )
}