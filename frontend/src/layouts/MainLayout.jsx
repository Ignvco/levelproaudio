// layouts/MainLayout.jsx
// Navbar estilo Jitter — dropdown con sliding indicator, blur scroll, mega-menu, mobile accordion

import { useState, useEffect, useRef, useCallback } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { useCartStore } from "../store/cartStore"

// ── Configuración del navbar ──────────────────────────────────
const NAV_ITEMS = [
  {
    label: "Tienda",
    to:    "/shop",
    mega:  {
      cols: [
        {
          type: "cards",
          items: [
            { label: "Micrófonos",  desc: "Condensadores, dinámicos, de cinta", to: "/shop?category=microfonos",  icon: "" },
            { label: "Interfaces",  desc: "Audio USB y Thunderbolt",            to: "/shop?category=interfaces",  icon: "" },
            { label: "Auriculares", desc: "Monitor y DJ profesional",           to: "/shop?category=auriculares", icon: "" },
            { label: "Monitores",   desc: "Studio monitors y nearfield",        to: "/shop?category=monitores",   icon: "" },
          ],
        },
        {
          type: "featured",
          title: "Ver toda la tienda",
          desc:  "Más de 500 productos para producción, grabación y mezcla.",
          cta:   "Explorar →",
          to:    "/shop",
        },
      ],
    },
  },
  {
    label: "Academia",
    to:    "/academy",
    mega:  {
      cols: [
        {
          type: "cards",
          items: [
            { label: "Producción musical", desc: "Beats, composición, DAWs",        to: "/academy?level=beginner",     icon: "" },
            { label: "Mezcla y masterización", desc: "EQ, compresión, efectos",     to: "/academy?level=intermediate", icon: "" },
            { label: "Grabación",           desc: "Técnicas de micrófono y sesión", to: "/academy?level=advanced",     icon: "" },
          ],
        },
        {
          type: "featured",
          title: "Aprendé de los mejores",
          desc:  "Cursos online con instructores profesionales. A tu ritmo.",
          cta:   "Ver cursos →",
          to:    "/academy",
        },
      ],
    },
  },
  { label: "Servicios", to: "/services" },
]

// ── Mega dropdown ─────────────────────────────────────────────
function MegaMenu({ item, visible }) {
  if (!item?.mega) return null

  return (
    <div
      aria-hidden={!visible}
      style={{
        position:     "absolute",
        top:          "calc(100% + 12px)",
        left:         "50%",
        transform:    `translateX(-50%) translateY(${visible ? "0" : "-10px"})`,
        opacity:      visible ? 1 : 0,
        pointerEvents:visible ? "auto" : "none",
        transition:   "opacity 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)",
        zIndex:       200,
        minWidth:     "520px",
      }}
    >
      {/* Triángulo arriba */}
      <div style={{
        position:      "absolute",
        top:           "-6px",
        left:          "50%",
        transform:     "translateX(-50%)",
        width:         "12px",
        height:        "6px",
        overflow:      "hidden",
      }}>
        <div style={{
          width:       "10px",
          height:      "10px",
          background:  "var(--surface)",
          border:      "1px solid var(--border)",
          transform:   "rotate(45deg)",
          margin:      "4px auto 0",
        }} />
      </div>

      {/* Panel */}
      <div style={{
        background:    "var(--surface)",
        border:        "1px solid var(--border)",
        borderRadius:  "var(--r-2xl)",
        padding:       "20px",
        boxShadow:     "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        display:       "grid",
        gridTemplateColumns: item.mega.cols.map(() => "1fr").join(" "),
        gap:           "12px",
      }}>
        {item.mega.cols.map((col, ci) => (
          <div key={ci}>
            {col.type === "cards" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {col.items.map((card) => (
                  <Link key={card.to} to={card.to} style={{
                    display:      "flex",
                    alignItems:   "flex-start",
                    gap:          "12px",
                    padding:      "10px 12px",
                    borderRadius: "var(--r-lg)",
                    textDecoration: "none",
                    transition:   "background 150ms",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{
                      fontSize:      "20px",
                      flexShrink:    0,
                      width:         "36px",
                      height:        "36px",
                      borderRadius:  "var(--r-md)",
                      background:    "var(--surface-2)",
                      display:       "flex",
                      alignItems:    "center",
                      justifyContent:"center",
                    }}>
                      {card.icon}
                    </span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", marginBottom: "2px" }}>
                        {card.label}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.5 }}>
                        {card.desc}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {col.type === "featured" && (
              <Link to={col.to} style={{
                display:       "flex",
                flexDirection: "column",
                justifyContent:"space-between",
                height:        "100%",
                padding:       "16px",
                borderRadius:  "var(--r-xl)",
                background:    "linear-gradient(135deg, rgba(26,255,110,0.06) 0%, rgba(26,255,110,0.02) 100%)",
                border:        "1px solid rgba(26,255,110,0.12)",
                textDecoration:"none",
                transition:    "border-color 200ms, background 200ms",
                minHeight:     "120px",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
                  e.currentTarget.style.background  = "linear-gradient(135deg, rgba(26,255,110,0.1) 0%, rgba(26,255,110,0.04) 100%)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(26,255,110,0.12)"
                  e.currentTarget.style.background  = "linear-gradient(135deg, rgba(26,255,110,0.06) 0%, rgba(26,255,110,0.02) 100%)"
                }}
              >
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
                    {col.title}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.6 }}>
                    {col.desc}
                  </p>
                </div>
                <span style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 500, marginTop: "14px" }}>
                  {col.cta}
                </span>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Menú mobile ───────────────────────────────────────────────
function MobileMenu({ open, onClose, user, logout, cartCount }) {
  const [expanded, setExpanded] = useState(null)
  const navigate                = useNavigate()

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else      document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  return (
    <div style={{
      position:  "fixed",
      inset:     0,
      zIndex:    150,
      background:"var(--bg)",
      overflowY: "auto",
      animation: "mobileMenuIn 280ms cubic-bezier(0.16,1,0.3,1)",
    }}>
      {/* Header del menú mobile */}
      <div style={{
        padding:        "0 24px",
        height:         "68px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        borderBottom:   "1px solid var(--border)",
      }}>
        <Link to="/" onClick={onClose}>
          <img src="/src/assets/logo.png" alt="LevelPro" style={{ height: "24px" }} />
        </Link>
        <button onClick={onClose} style={{
          width:           "36px",
          height:          "36px",
          borderRadius:    "50%",
          background:      "var(--surface-2)",
          border:          "1px solid var(--border)",
          color:           "var(--text)",
          fontSize:        "18px",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          cursor:          "pointer",
        }}>
          ✕
        </button>
      </div>

      {/* Nav items */}
      <div style={{ padding: "16px 24px" }}>
        {NAV_ITEMS.map((item) => (
          <div key={item.label} style={{ borderBottom: "1px solid var(--border)" }}>
            {item.mega ? (
              <>
                <button
                  onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                  style={{
                    width:          "100%",
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "center",
                    padding:        "16px 0",
                    background:     "none",
                    border:         "none",
                    color:          "var(--text)",
                    fontSize:       "16px",
                    cursor:         "pointer",
                  }}
                >
                  {item.label}
                  <span style={{
                    fontSize:   "12px",
                    color:      "var(--text-3)",
                    transform:  expanded === item.label ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 200ms var(--ease)",
                  }}>▼</span>
                </button>

                {/* Acordeón */}
                <div style={{
                  maxHeight:  expanded === item.label ? "600px" : "0",
                  overflow:   "hidden",
                  transition: "max-height 300ms cubic-bezier(0.16,1,0.3,1)",
                }}>
                  <div style={{ paddingBottom: "12px" }}>
                    {item.mega.cols.flatMap(col =>
                      col.type === "cards" ? col.items : []
                    ).map(card => (
                      <Link key={card.to} to={card.to} onClick={onClose} style={{
                        display:        "flex",
                        alignItems:     "center",
                        gap:            "12px",
                        padding:        "10px 0 10px 12px",
                        borderRadius:   "var(--r-md)",
                        textDecoration: "none",
                        color:          "var(--text-2)",
                        fontSize:       "15px",
                      }}>
                        <span>{card.icon}</span>
                        {card.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Link to={item.to} onClick={onClose} style={{
                display:        "block",
                padding:        "16px 0",
                color:          "var(--text)",
                fontSize:       "16px",
                textDecoration: "none",
              }}>
                {item.label}
              </Link>
            )}
          </div>
        ))}

        {/* Cart */}
        <Link to="/cart" onClick={onClose} style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "16px 0",
          borderBottom:   "1px solid var(--border)",
          color:          "var(--text)",
          fontSize:       "16px",
          textDecoration: "none",
        }}>
          <span>Carrito</span>
          {cartCount > 0 && (
            <span style={{
              background:    "var(--accent)",
              color:         "#000",
              borderRadius:  "var(--r-full)",
              fontSize:      "12px",
              fontWeight:    700,
              padding:       "2px 8px",
            }}>
              {cartCount}
            </span>
          )}
        </Link>

        {/* Auth */}
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {user ? (
            <>
              <Link to="/dashboard" onClick={onClose} className="btn btn-ghost"
                style={{ justifyContent:"center", fontSize:"15px" }}>
                Mi cuenta
              </Link>
              <button onClick={() => { logout(); navigate("/"); onClose() }}
                style={{
                  padding:       "13px",
                  borderRadius:  "var(--r-full)",
                  background:    "none",
                  border:        "1px solid var(--border)",
                  color:         "var(--text-3)",
                  fontSize:      "15px",
                  cursor:        "pointer",
                }}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={onClose} className="btn btn-ghost"
                style={{ justifyContent:"center", fontSize:"15px" }}>
                Iniciar sesión
              </Link>
              <Link to="/register" onClick={onClose} className="btn btn-accent"
                style={{ justifyContent:"center", fontSize:"15px" }}>
                Registrarse gratis
              </Link>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes mobileMenuIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── MainLayout ────────────────────────────────────────────────
export default function MainLayout({ children }) {
  const { isAuthenticated, user, logout } = useAuthStore()
  const { getCount }                      = useCartStore()
  const cartCount                         = getCount()
  const location                          = useLocation()
  const navigate                          = useNavigate()

  // Estado del scroll
  const [scrolled,    setScrolled]    = useState(false)
  // Qué item del mega-menu está abierto
  const [activeMenu,  setActiveMenu]  = useState(null)
  // Timer para el delay de cierre (evita cierre accidental al mover mouse)
  const closeTimer                    = useRef(null)
  // Posición del sliding indicator
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 })
  // Refs de los botones nav para medir posición
  const navRefs                       = useRef({})
  // Mobile menu
  const [mobileOpen,  setMobileOpen]  = useState(false)
  // User dropdown
  const [userOpen,    setUserOpen]    = useState(false)
  const userRef                       = useRef(null)

  // ── Scroll listener ──────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // ── Cerrar menú al navegar ────────────────────────────────────
  useEffect(() => {
    setActiveMenu(null)
    setMobileOpen(false)
    setUserOpen(false)
  }, [location.pathname])

  // ── Cerrar user dropdown al click fuera ──────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Sliding indicator ─────────────────────────────────────────
  const updateIndicator = useCallback((label) => {
    const el = navRefs.current[label]
    if (!el) { setIndicatorStyle(s => ({ ...s, opacity: 0 })); return }
    const rect       = el.getBoundingClientRect()
    const parentRect = el.closest("nav")?.getBoundingClientRect()
    if (!parentRect) return
    setIndicatorStyle({
      left:    rect.left - parentRect.left,
      width:   rect.width,
      opacity: 1,
    })
  }, [])

  const clearIndicator = useCallback(() => {
    setIndicatorStyle(s => ({ ...s, opacity: 0 }))
  }, [])

  // ── Handlers del mega-menu ────────────────────────────────────
  const openMenu = useCallback((label) => {
    clearTimeout(closeTimer.current)
    setActiveMenu(label)
    updateIndicator(label)
  }, [updateIndicator])

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setActiveMenu(null)
      clearIndicator()
    }, 140) // delay para pasar el mouse al dropdown
  }, [clearIndicator])

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current)
  }, [])

  // ── Active route ──────────────────────────────────────────────
  const isActive = (to) => location.pathname.startsWith(to)

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* Mobile menu */}
      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        logout={logout}
        cartCount={cartCount}
      />

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header style={{
        position:             "fixed",
        top:                  0,
        left:                 0,
        right:                0,
        zIndex:               100,
        height:               "68px",
        display:              "flex",
        alignItems:           "center",
        transition:           "background 300ms ease, backdrop-filter 300ms ease, border-color 300ms ease",
        background:           scrolled ? "rgba(8,8,8,0.82)" : "transparent",
        backdropFilter:       scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom:         scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}>
        <div style={{
          maxWidth:       "var(--container)",
          margin:         "0 auto",
          padding:        "0 clamp(20px, 5vw, 48px)",
          width:          "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            "32px",
        }}>

          {/* Logo */}
          <Link to="/" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
            <img src="/src/assets/logo.png" alt="LevelPro Audio"
              style={{ height:"26px", width:"auto" }} />
          </Link>

          {/* ── Nav central — desktop ── */}
          <nav style={{
            display:        "flex",
            alignItems:     "center",
            position:       "relative",
            gap:            "2px",
          }}
            className="nav-desktop"
            onMouseLeave={scheduleClose}
          >
            {/* Sliding pill indicator */}
            <div style={{
              position:     "absolute",
              bottom:       "-2px",
              height:       "2px",
              borderRadius: "1px",
              background:   "var(--accent)",
              transition:   "left 200ms cubic-bezier(0.16,1,0.3,1), width 200ms cubic-bezier(0.16,1,0.3,1), opacity 150ms",
              left:         `${indicatorStyle.left}px`,
              width:        `${indicatorStyle.width}px`,
              opacity:      indicatorStyle.opacity,
              pointerEvents:"none",
            }} />

            {NAV_ITEMS.map((item) => {
              const hasMega = !!item.mega
              const active  = isActive(item.to)

              return (
                <div key={item.label} style={{ position: "relative" }}>
                  {hasMega ? (
                    <button
                      ref={el => navRefs.current[item.label] = el}
                      onMouseEnter={() => openMenu(item.label)}
                      onFocus={() => openMenu(item.label)}
                      style={{
                        display:       "flex",
                        alignItems:    "center",
                        gap:           "4px",
                        padding:       "8px 14px",
                        borderRadius:  "var(--r-full)",
                        background:    active || activeMenu === item.label
                          ? "var(--surface-2)" : "transparent",
                        border:        "none",
                        color:         active || activeMenu === item.label
                          ? "var(--text)" : "var(--text-2)",
                        fontSize:      "14px",
                        cursor:        "pointer",
                        transition:    "background 150ms, color 150ms",
                        whiteSpace:    "nowrap",
                      }}
                    >
                      {item.label}
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                        style={{
                          transform:  activeMenu === item.label ? "rotate(180deg)" : "rotate(0)",
                          transition: "transform 200ms var(--ease)",
                          opacity:    0.5,
                        }}>
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ) : (
                    <Link
                      to={item.to}
                      ref={el => navRefs.current[item.label] = el}
                      onMouseEnter={() => { cancelClose(); clearIndicator(); openMenu(item.label) }}
                      style={{
                        display:      "block",
                        padding:      "8px 14px",
                        borderRadius: "var(--r-full)",
                        background:   active ? "var(--surface-2)" : "transparent",
                        color:        active  ? "var(--text)"     : "var(--text-2)",
                        fontSize:     "14px",
                        transition:   "background 150ms, color 150ms",
                        whiteSpace:   "nowrap",
                        textDecoration: "none",
                      }}
                    >
                      {item.label}
                    </Link>
                  )}

                  {/* Mega dropdown del item */}
                  {hasMega && (
                    <div
                      onMouseEnter={cancelClose}
                      onMouseLeave={scheduleClose}
                    >
                      <MegaMenu item={item} visible={activeMenu === item.label} />
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* ── Acciones derecha — desktop ── */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}
            className="nav-desktop">

            {/* Carrito */}
            <Link to="/cart" style={{
              position:       "relative",
              width:          "38px",
              height:         "38px",
              borderRadius:   "50%",
              background:     "var(--surface-2)",
              border:         "1px solid var(--border)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              color:          "var(--text-2)",
              fontSize:       "16px",
              transition:     "all 150ms",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background    = "var(--surface-3)"
                e.currentTarget.style.borderColor   = "var(--border-hover)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background    = "var(--surface-2)"
                e.currentTarget.style.borderColor   = "var(--border)"
              }}
            >
              🛒
              {cartCount > 0 && (
                <span style={{
                  position:       "absolute",
                  top:            "-3px",
                  right:          "-3px",
                  background:     "var(--accent)",
                  color:          "#000",
                  fontSize:       "9px",
                  fontWeight:     800,
                  width:          "16px",
                  height:         "16px",
                  borderRadius:   "50%",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  border:         "2px solid var(--bg)",
                  lineHeight:     1,
                }}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <div ref={userRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setUserOpen(!userOpen)}
                  style={{
                    width:          "38px",
                    height:         "38px",
                    borderRadius:   "50%",
                    background:     userOpen ? "var(--accent)" : "var(--accent-dim)",
                    border:         "1px solid var(--accent-glow)",
                    color:          userOpen ? "#000"           : "var(--accent)",
                    fontSize:       "14px",
                    fontWeight:     700,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    cursor:         "pointer",
                    transition:     "all 150ms",
                  }}
                >
                  {user?.first_name?.[0]?.toUpperCase() || "U"}
                </button>

                {userOpen && (
                  <div style={{
                    position:        "absolute",
                    top:             "calc(100% + 10px)",
                    right:           0,
                    minWidth:        "210px",
                    background:      "var(--surface)",
                    border:          "1px solid var(--border)",
                    borderRadius:    "var(--r-2xl)",
                    padding:         "8px",
                    boxShadow:       "0 20px 60px rgba(0,0,0,0.5)",
                    animation:       "scaleIn 150ms var(--ease)",
                    transformOrigin: "top right",
                  }}>
                    <div style={{ padding:"10px 12px 10px", borderBottom:"1px solid var(--border)",
                      marginBottom:"6px" }}>
                      <p style={{ fontSize:"13px", fontWeight:500 }}>
                        {user?.first_name || user?.email?.split("@")[0]}
                      </p>
                      <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px" }}>
                        {user?.email}
                      </p>
                    </div>

                    {[
                      { to:"/dashboard",          label:"Mi cuenta",   icon:"◈" },
                      { to:"/dashboard/orders",   label:"Pedidos",     icon:"◫" },
                      { to:"/dashboard/courses",  label:"Mis cursos",  icon:"▷" },
                      ...(user?.is_staff ? [{ to:"/admin", label:"Admin", icon:"⊕" }] : []),
                    ].map(({ to, label, icon }) => (
                      <Link key={to} to={to} onClick={() => setUserOpen(false)} style={{
                        display:      "flex",
                        alignItems:   "center",
                        gap:          "10px",
                        padding:      "9px 12px",
                        borderRadius: "var(--r-md)",
                        fontSize:     "13px",
                        color:        "var(--text-2)",
                        textDecoration:"none",
                        transition:   "background 120ms",
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ fontSize:"11px", color:"var(--text-3)" }}>{icon}</span>
                        {label}
                      </Link>
                    ))}

                    <div style={{ borderTop:"1px solid var(--border)", margin:"6px 0" }} />
                    <button onClick={() => { logout(); navigate("/"); setUserOpen(false) }} style={{
                      width:        "100%",
                      display:      "flex",
                      alignItems:   "center",
                      gap:          "10px",
                      padding:      "9px 12px",
                      borderRadius: "var(--r-md)",
                      fontSize:     "13px",
                      color:        "var(--text-3)",
                      background:   "none",
                      border:       "none",
                      cursor:       "pointer",
                      textAlign:    "left",
                      transition:   "background 120ms",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <span>↗</span> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <Link to="/login" style={{
                  padding:      "8px 16px",
                  borderRadius: "var(--r-full)",
                  fontSize:     "14px",
                  color:        "var(--text-2)",
                  background:   "transparent",
                  border:       "1px solid transparent",
                  transition:   "all 150ms",
                  textDecoration:"none",
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color       = "var(--text)"
                    e.currentTarget.style.borderColor = "var(--border)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color       = "var(--text-2)"
                    e.currentTarget.style.borderColor = "transparent"
                  }}
                >
                  Iniciar sesión
                </Link>

                {/* Botón "Try for free" estilo Jitter — fondo blanco, texto negro */}
                <Link to="/register" style={{
                  padding:       "8px 18px",
                  borderRadius:  "var(--r-full)",
                  fontSize:      "14px",
                  fontWeight:    500,
                  color:         "#000",
                  background:    "#f0f0f0",
                  border:        "none",
                  transition:    "all 150ms",
                  textDecoration:"none",
                  letterSpacing: "-0.01em",
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background  = "#ffffff"
                    e.currentTarget.style.transform   = "scale(0.98)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background  = "#f0f0f0"
                    e.currentTarget.style.transform   = "scale(1)"
                  }}
                >
                  Registrarse gratis
                </Link>
              </div>
            )}
          </div>

          {/* ── Hamburger — mobile ── */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            style={{
              display:        "none",
              width:          "38px",
              height:         "38px",
              borderRadius:   "var(--r-md)",
              background:     "var(--surface-2)",
              border:         "1px solid var(--border)",
              color:          "var(--text)",
              fontSize:       "18px",
              alignItems:     "center",
              justifyContent: "center",
              cursor:         "pointer",
              flexShrink:     0,
            }}
            id="hamburger-btn"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main style={{ flex: 1, paddingTop: "68px" }}>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop:  "1px solid var(--border)",
        padding:    "clamp(48px, 7vw, 88px) clamp(20px, 5vw, 60px) clamp(32px, 4vw, 48px)",
        background: "var(--bg-2)",
      }}>
        <div style={{ maxWidth:"var(--container)", margin:"0 auto" }}>
          <div style={{
            display:             "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap:                 "clamp(32px, 5vw, 60px)",
            marginBottom:        "clamp(40px, 6vw, 64px)",
          }}
            className="footer-grid"
          >
            {/* Brand */}
            <div>
              <img src="/src/assets/logo.png" alt="LevelPro Audio"
                style={{ height:"26px", marginBottom:"16px" }} />
              <p style={{ fontSize:"14px", color:"var(--text-3)", lineHeight:1.7, maxWidth:"280px" }}>
                Equipamiento de audio profesional para músicos, productores y estudios
                en Chile y Argentina.
              </p>
            </div>

            {[
              {
                title: "Tienda",
                links: [
                  { to:"/shop",                        label:"Todos los productos" },
                  { to:"/shop?category=microfonos",    label:"Micrófonos"         },
                  { to:"/shop?category=interfaces",    label:"Interfaces"         },
                  { to:"/shop?category=auriculares",   label:"Auriculares"        },
                ],
              },
              {
                title: "Plataforma",
                links: [
                  { to:"/academy",   label:"Academia"  },
                  { to:"/services",  label:"Servicios" },
                  { to:"/dashboard", label:"Mi cuenta" },
                ],
              },
              {
                title: "Empresa",
                links: [
                  { href:"https://wa.me/5492622635045", label:"WhatsApp"  },
                  { to:"/login",                        label:"Iniciar sesión" },
                ],
              },
            ].map(({ title, links }) => (
              <div key={title}>
                <p style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"16px" }}>
                  {title}
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {links.map(({ to, href, label }) =>
                    href ? (
                      <a key={label} href={href} target="_blank" rel="noreferrer"
                        style={{ fontSize:"14px", color:"var(--text-3)", transition:"color 150ms",
                          textDecoration:"none" }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
                        {label}
                      </a>
                    ) : (
                      <Link key={to} to={to}
                        style={{ fontSize:"14px", color:"var(--text-3)", transition:"color 150ms",
                          textDecoration:"none" }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
                        {label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ paddingTop:"24px", borderTop:"1px solid var(--border)",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            flexWrap:"wrap", gap:"12px" }}>
            <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
              © 2026 LevelPro Audio. Todos los derechos reservados.
            </p>
            <div style={{ display:"flex", gap:"20px" }}>
              {["Términos","Privacidad"].map(item => (
                <span key={item} style={{ fontSize:"13px", color:"var(--text-3)",
                  cursor:"pointer", transition:"color 150ms" }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── CSS responsive ── */}
      <style>{`
        @media (max-width: 860px) {
          .nav-desktop { display: none !important; }
          #hamburger-btn { display: flex !important; }
        }
        @media (max-width: 640px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 400px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
