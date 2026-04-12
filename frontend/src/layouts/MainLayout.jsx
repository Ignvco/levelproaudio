// layouts/MainLayout.jsx
import { useState, useEffect, useRef, useCallback } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { useCartStore } from "../store/cartStore"
import logoImg from "../assets/logo.png"

// ─────────────────────────────────────────────────────────────
// Configuración de navegación
// ─────────────────────────────────────────────────────────────
const NAV_LINKS = [
  {
    label: "Tienda",
    to: "/shop",
    mega: {
      cols: [
        {
          type: "links",
          items: [
            {label: "Micrófonos",  desc: "Condensadores, dinámicos, de cinta", to: "/shop?category=microfonos"  },
            {label: "Interfaces",  desc: "Audio USB y Thunderbolt",            to: "/shop?category=interfaces"  },
            {label: "Auriculares", desc: "Monitor y DJ profesional",           to: "/shop?category=auriculares" },
            {label: "Monitores",   desc: "Studio monitors y nearfield",        to: "/shop?category=monitores"   },
          ],
        },
        {
          type: "featured",
          icon: "🛒",
          title: "Explorar toda la tienda",
          desc: "Más de 500 productos para grabación, producción y mezcla profesional.",
          cta: "Ver catálogo completo →",
          to: "/shop",
        },
      ],
    },
  },
  {
    label: "Academia",
    to: "/academy",
    mega: {
      cols: [
        {
          type: "links",
          items: [
            { label: "Producción musical",      desc: "Beats, composición, DAWs",      to: "/academy" },
            { label: "Mezcla y masterización",  desc: "EQ, compresión, efectos",       to: "/academy" },
            { label: "Técnicas de grabación",   desc: "Micrófonos, sesión, acústica",  to: "/academy" },
          ],
        },
        {
          type: "featured",
          icon: "🎬",
          title: "Aprendé con los mejores",
          desc: "Cursos online con instructores profesionales. Avanzá a tu ritmo.",
          cta: "Ver todos los cursos →",
          to: "/academy",
        },
      ],
    },
  },
  { label: "Servicios", to: "/services" },
]

// ─────────────────────────────────────────────────────────────
// Mega dropdown
// ─────────────────────────────────────────────────────────────
function MegaPanel({ item, visible }) {
  if (!item?.mega) return null
  return (
    <div style={{
      position:      "absolute",
      top:           "calc(100% + 14px)",
      left:          "50%",
      transform:     `translateX(-50%) translateY(${visible ? "0px" : "-8px"})`,
      opacity:       visible ? 1 : 0,
      pointerEvents: visible ? "auto" : "none",
      transition:    "opacity 200ms cubic-bezier(0.16,1,0.3,1), transform 200ms cubic-bezier(0.16,1,0.3,1)",
      zIndex:        500,
      minWidth:      "500px",
    }}>
      {/* Triángulo */}
      <div style={{
        position:    "absolute",
        top:         "-5px",
        left:        "50%",
        transform:   "translateX(-50%) rotate(45deg)",
        width:       "10px",
        height:      "10px",
        background:  "var(--surface)",
        border:      "1px solid var(--border)",
        borderRight: "none",
        borderBottom:"none",
        zIndex:      1,
      }} />

      {/* Panel */}
      <div style={{
        background:   "var(--surface)",
        border:       "1px solid var(--border)",
        borderRadius: "20px",
        padding:      "16px",
        boxShadow:    "0 32px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)",
        display:      "grid",
        gridTemplateColumns: item.mega.cols.map(c => c.type === "featured" ? "1fr" : "1.4fr").join(" "),
        gap:          "10px",
        position:     "relative",
        zIndex:       2,
      }}>
        {item.mega.cols.map((col, ci) => (
          <div key={ci}>
            {col.type === "links" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {col.items.map(card => (
                  <Link key={card.to + card.label} to={card.to} style={{
                    display:        "flex",
                    alignItems:     "center",
                    gap:            "12px",
                    padding:        "10px 12px",
                    borderRadius:   "12px",
                    textDecoration: "none",
                    transition:     "background 140ms",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize:"13px", fontWeight:500, color:"var(--text)", marginBottom:"2px" }}>{card.label}</p>
                      <p style={{ fontSize:"12px", color:"var(--text-3)", lineHeight:1.4 }}>{card.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {col.type === "featured" && (
              <Link to={col.to} style={{
                display:"flex", flexDirection:"column", padding:"18px",
                borderRadius:"14px",
                background:"linear-gradient(145deg,rgba(26,255,110,0.07) 0%,rgba(26,255,110,0.02) 100%)",
                border:"1px solid rgba(26,255,110,0.15)",
                textDecoration:"none", transition:"border-color 180ms,background 180ms",
                height:"100%", gap:"10px",
              }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(26,255,110,0.35)";e.currentTarget.style.background="linear-gradient(145deg,rgba(26,255,110,0.12) 0%,rgba(26,255,110,0.04) 100%)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(26,255,110,0.15)";e.currentTarget.style.background="linear-gradient(145deg,rgba(26,255,110,0.07) 0%,rgba(26,255,110,0.02) 100%)"}}
              >
                <span style={{ fontSize:"28px" }}>{col.icon}</span>
                <div>
                  <p style={{ fontSize:"14px", fontWeight:600, color:"var(--text)", marginBottom:"6px" }}>{col.title}</p>
                  <p style={{ fontSize:"12px", color:"var(--text-3)", lineHeight:1.6 }}>{col.desc}</p>
                </div>
                <p style={{ fontSize:"13px", fontWeight:500, color:"var(--accent)", marginTop:"auto" }}>{col.cta}</p>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Mobile menu — panel desde la derecha + accordion
// ─────────────────────────────────────────────────────────────
function MobileMenu({ open, onClose, isAuthenticated, user, logout }) {
  const [expanded, setExpanded] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position:"fixed", inset:0, zIndex:199,
        background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
        transition:"opacity 280ms ease",
      }} />

      {/* Panel deslizante */}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0,
        width:"min(360px, 92vw)", zIndex:200,
        background:"var(--bg)",
        borderLeft:"1px solid var(--border)",
        overflowY:"auto",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition:"transform 320ms cubic-bezier(0.16,1,0.3,1)",
        boxShadow: open ? "-24px 0 80px rgba(0,0,0,0.6)" : "none",
        display:"flex", flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 20px", height:"68px", borderBottom:"1px solid var(--border)", flexShrink:0,
        }}>
          <Link to="/" onClick={onClose}>
            <img src={logoImg} alt="LevelPro" style={{ height:"22px", filter:"brightness(0) invert(1)" }} />
          </Link>
          <button onClick={onClose} style={{
            width:"34px", height:"34px", borderRadius:"50%",
            background:"var(--surface-2)", border:"1px solid var(--border)",
            color:"var(--text)", fontSize:"16px", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>✕</button>
        </div>

        {/* Links */}
        <div style={{ padding:"12px 16px", flex:1 }}>
          {NAV_LINKS.map(item => (
            <div key={item.label}>
              {item.mega ? (
                <>
                  <button onClick={() => setExpanded(expanded===item.label ? null : item.label)} style={{
                    width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"14px 12px", background:"none", border:"none",
                    borderBottom:"1px solid var(--border)",
                    color:"var(--text)", fontSize:"16px", cursor:"pointer", fontFamily:"inherit",
                  }}>
                    {item.label}
                    <span style={{
                      fontSize:"10px", color:"var(--text-3)",
                      transform: expanded===item.label ? "rotate(180deg)" : "rotate(0)",
                      transition:"transform 220ms var(--ease)", display:"inline-block",
                    }}>▼</span>
                  </button>
                  <div style={{
                    maxHeight: expanded===item.label ? "400px" : "0",
                    overflow:"hidden",
                    transition:"max-height 300ms cubic-bezier(0.16,1,0.3,1)",
                  }}>
                    <div style={{ padding:"8px 0 12px 12px" }}>
                      {item.mega.cols.filter(c=>c.type==="links").flatMap(c=>c.items).map(card => (
                        <Link key={card.to+card.label} to={card.to} onClick={onClose} style={{
                          display:"flex", alignItems:"center", gap:"12px",
                          padding:"11px 12px", borderRadius:"10px",
                          textDecoration:"none", color:"var(--text-2)", fontSize:"15px",
                          transition:"background 140ms",
                        }}
                          onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                        >
                          <span style={{ fontSize:"20px" }}>{card.icon}</span>
                          {card.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <Link to={item.to} onClick={onClose} style={{
                  display:"block", padding:"14px 12px",
                  borderBottom:"1px solid var(--border)",
                  color:"var(--text)", fontSize:"16px", textDecoration:"none",
                }}>{item.label}</Link>
              )}
            </div>
          ))}
          <Link to="/cart" onClick={onClose} style={{
            display:"block", padding:"14px 12px",
            borderBottom:"1px solid var(--border)",
            color:"var(--text)", fontSize:"16px", textDecoration:"none",
          }}>Carrito</Link>
        </div>

        {/* Auth bottom */}
        <div style={{ padding:"16px 20px 32px", borderTop:"1px solid var(--border)", flexShrink:0 }}>
          {isAuthenticated ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <Link to="/dashboard" onClick={onClose} style={{
                display:"block", padding:"13px", borderRadius:"var(--r-full)",
                border:"1px solid var(--border)", color:"var(--text)",
                fontSize:"15px", textAlign:"center", textDecoration:"none",
              }}>Mi cuenta</Link>
              <button onClick={()=>{logout();navigate("/");onClose()}} style={{
                padding:"13px", borderRadius:"var(--r-full)", background:"none",
                border:"1px solid var(--border)", color:"var(--text-3)",
                fontSize:"15px", cursor:"pointer", fontFamily:"inherit",
              }}>Cerrar sesión</button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <Link to="/login" onClick={onClose} style={{
                display:"block", padding:"13px", borderRadius:"var(--r-full)",
                border:"1px solid var(--border)", color:"var(--text)",
                fontSize:"15px", textAlign:"center", textDecoration:"none",
              }}>Iniciar sesión</Link>
              <Link to="/register" onClick={onClose} style={{
                display:"block", padding:"13px", borderRadius:"var(--r-full)",
                background:"#efefef", color:"#000",
                fontSize:"15px", fontWeight:500, textAlign:"center", textDecoration:"none",
              }}>Registrarse gratis</Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────
function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const cartCount = useCartStore(s => s.getCount())
  const navigate  = useNavigate()
  const location  = useLocation()

  // ── scrollProgress: 0 (top) → 1 (fully scrolled) ──────────
  // Usamos rAF para leer window.scrollY sin causar forced reflows
  const [scrollProgress, setScrollProgress] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const THRESHOLD = 80

    const tick = () => {
      setScrollProgress(Math.min(window.scrollY / THRESHOLD, 1))
      rafRef.current = null
    }

    const onScroll = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick)
    }

    tick() // calcular al montar
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Valores derivados de scrollProgress — todo interpolado suavemente
  const navH         = 72 - scrollProgress * 12        // 72px → 60px
  const bgOpacity    = scrollProgress * 0.88            // fondo negro
  const blurOpacity  = scrollProgress                   // capa de blur
  const borderA      = scrollProgress * 0.07            // border inferior
  const logoScale    = 1 - scrollProgress * 0.08        // logo shrink
  const linkA        = 0.65 + scrollProgress * 0.35     // link opacity

  // ── Mega menu ─────────────────────────────────────────────
  const [activeMenu, setActiveMenu] = useState(null)
  const closeTimer = useRef(null)

  const navBarRef = useRef(null)
  const navRefs   = useRef({})
  const [ind, setInd] = useState({ left:0, width:0, opacity:0 })

  const moveInd = useCallback((label) => {
    const el = navRefs.current[label]
    const nb = navBarRef.current
    if (!el || !nb) return
    const er = el.getBoundingClientRect()
    const nr = nb.getBoundingClientRect()
    setInd({ left: er.left - nr.left, width: er.width, opacity: 1 })
  }, [])

  const hideInd = useCallback(() => {
    setInd(s => ({ ...s, opacity: 0 }))
  }, [])

  const openMenu = useCallback((label) => {
    clearTimeout(closeTimer.current)
    setActiveMenu(label)
    moveInd(label)
  }, [moveInd])

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setActiveMenu(null)
      hideInd()
    }, 150)
  }, [hideInd])

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current)
  }, [])

  // ── Cerrar al navegar ─────────────────────────────────────
  useEffect(() => {
    setActiveMenu(null)
    hideInd()
    setMobileOpen(false)
    setUserOpen(false)
  }, [location.pathname])

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userOpen,   setUserOpen]   = useState(false)
  const userRef = useRef(null)

  useEffect(() => {
    const fn = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  return (
    <>
      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isAuthenticated={isAuthenticated}
        user={user}
        logout={logout}
      />

      <header style={{
        position: "fixed",
        top:      0,
        left:     0,
        right:    0,
        zIndex:   100,
        height:   `${navH}px`,
        // Sin transition CSS para height — lo controla rAF directamente en cada frame
        // El efecto es instantáneo y suave porque scrollProgress es continuo
      }}>

        {/* ═══ CAPA 1: Blur (siempre presente, opacity animada) ═══
            Truco crítico de Jitter: si usás backdrop-filter:none → blur,
            Chrome no transiciona. La solución es tener el blur SIEMPRE
            y controlar su visibilidad con opacity. */}
        <div style={{
          position:             "absolute",
          inset:                0,
          backdropFilter:       "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          opacity:              blurOpacity,
          transition:           "opacity 80ms linear",
          zIndex:               0,
          pointerEvents:        "none",
        }} />

        {/* ═══ CAPA 2: Fondo oscuro ═══ */}
        <div style={{
          position:    "absolute",
          inset:       0,
          background:  `rgba(8,8,8,${bgOpacity})`,
          transition:  "background 80ms linear",
          zIndex:      0,
          pointerEvents:"none",
        }} />

        {/* ═══ CAPA 3: Border inferior ═══ */}
        <div style={{
          position:    "absolute",
          bottom:      0,
          left:        0,
          right:       0,
          height:      "1px",
          background:  `rgba(255,255,255,${borderA})`,
          transition:  "background 80ms linear",
          zIndex:      0,
          pointerEvents:"none",
        }} />

        {/* ═══ CONTENIDO (z-index sobre las capas) ═══ */}
        <div style={{
          position:       "relative",
          zIndex:         1,
          height:         "100%",
          maxWidth:       "var(--container, 1200px)",
          margin:         "0 auto",
          padding:        "0 clamp(20px, 4vw, 48px)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            "24px",
        }}>

          {/* Logo */}
          <Link to="/" style={{
            display:         "flex",
            alignItems:      "center",
            flexShrink:      0,
            transform:       `scale(${logoScale})`,
            transformOrigin: "left center",
            // Sin transition CSS — suavidad viene de scrollProgress continuo via rAF
          }}>
            <img src={logoImg} alt="LevelPro Audio" style={{
              height:"28px", objectFit:"contain",
              filter:"brightness(0) invert(1)", maxWidth:"140px", display:"block",
            }} />
          </Link>

          {/* ── Nav central — desktop ── */}
          <nav
            ref={navBarRef}
            onMouseLeave={scheduleClose}
            style={{ display:"flex", alignItems:"center", position:"relative", gap:"2px" }}
            className="lp-nav-desktop"
          >
            {/* Sliding indicator */}
            <div style={{
              position:    "absolute",
              bottom:      "-1px",
              height:      "2px",
              borderRadius:"1px",
              background:  "var(--accent)",
              left:        `${ind.left}px`,
              width:       `${ind.width}px`,
              opacity:     ind.opacity,
              pointerEvents:"none",
              transition:  "left 200ms cubic-bezier(0.16,1,0.3,1), width 200ms cubic-bezier(0.16,1,0.3,1), opacity 150ms ease",
            }} />

            {NAV_LINKS.map(item => {
              const hasMega  = !!item.mega
              const isActive = location.pathname.startsWith(item.to)
              const textCol  = (isActive || activeMenu===item.label)
                ? "rgba(255,255,255,1)"
                : `rgba(255,255,255,${linkA})`

              return (
                <div key={item.label} style={{ position:"relative" }}>
                  {hasMega ? (
                    <button
                      ref={el => navRefs.current[item.label] = el}
                      onMouseEnter={() => openMenu(item.label)}
                      style={{
                        display:"flex", alignItems:"center", gap:"5px",
                        padding:"8px 14px", borderRadius:"var(--r-full)",
                        background: (isActive||activeMenu===item.label) ? "rgba(255,255,255,0.08)" : "transparent",
                        border:"none", color: textCol,
                        fontSize:"14px", cursor:"pointer", transition:"background 150ms, color 150ms",
                        whiteSpace:"nowrap", fontFamily:"inherit",
                      }}
                    >
                      {item.label}
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                        style={{
                          transform:  activeMenu===item.label ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
                          opacity:    0.5, flexShrink:0,
                        }}>
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ) : (
                    <Link
                      to={item.to}
                      ref={el => navRefs.current[item.label] = el}
                      onMouseEnter={() => { cancelClose(); setActiveMenu(null); hideInd(); moveInd(item.label) }}
                      onMouseLeave={scheduleClose}
                      style={{
                        display:"block", padding:"8px 14px", borderRadius:"var(--r-full)",
                        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                        color: textCol,
                        fontSize:"14px", transition:"background 150ms, color 150ms",
                        whiteSpace:"nowrap", textDecoration:"none",
                      }}
                    >{item.label}</Link>
                  )}

                  {hasMega && (
                    <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
                      <MegaPanel item={item} visible={activeMenu===item.label} />
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* ── Acciones derecha — desktop ── */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}
            className="lp-nav-desktop">

            {/* Carrito */}
            <Link to="/cart" style={{
              position:"relative", width:"38px", height:"38px", borderRadius:"50%",
              border:"1px solid rgba(255,255,255,0.12)",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:`rgba(255,255,255,${linkA})`,
              transition:"border-color 150ms, color 150ms, background 150ms",
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.3)";e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color="#fff"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";e.currentTarget.style.background="transparent";e.currentTarget.style.color=`rgba(255,255,255,${linkA})`}}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              {cartCount > 0 && (
                <span style={{
                  position:"absolute", top:"-3px", right:"-3px",
                  background:"var(--accent)", color:"#000",
                  fontSize:"9px", fontWeight:800,
                  width:"16px", height:"16px", borderRadius:"50%",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  border:"2px solid var(--bg)",
                }}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <div ref={userRef} style={{ position:"relative" }}>
                <button onClick={() => setUserOpen(!userOpen)} style={{
                  width:"38px", height:"38px", borderRadius:"50%",
                  background: userOpen ? "var(--accent)"         : "rgba(26,255,110,0.15)",
                  border:     "1px solid rgba(26,255,110,0.3)",
                  color:      userOpen ? "#000"                  : "var(--accent)",
                  fontSize:"13px", fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer", transition:"all 150ms", fontFamily:"inherit",
                }}>
                  {user?.first_name?.[0]?.toUpperCase() || "U"}
                </button>

                {userOpen && (
                  <div style={{
                    position:"absolute", top:"calc(100% + 12px)", right:0,
                    minWidth:"220px",
                    background:"var(--surface)", border:"1px solid var(--border)",
                    borderRadius:"16px", padding:"8px",
                    boxShadow:"0 24px 60px rgba(0,0,0,0.6)",
                    animation:"scaleIn 150ms cubic-bezier(0.16,1,0.3,1)",
                    transformOrigin:"top right",
                  }}>
                    <div style={{ padding:"10px 12px 12px", borderBottom:"1px solid var(--border)", marginBottom:"6px" }}>
                      <p style={{ fontSize:"13px", fontWeight:500, color:"var(--text)" }}>
                        {user?.first_name ? `${user.first_name} ${user.last_name||""}`.trim() : "Mi cuenta"}
                      </p>
                      <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px" }}>{user?.email}</p>
                    </div>
                    {[
                      { to:"/dashboard",         label:"Mi cuenta",   icon:"◈" },
                      { to:"/dashboard/orders",  label:"Pedidos",     icon:"◫" },
                      { to:"/dashboard/courses", label:"Mis cursos",  icon:"▷" },
                      ...(user?.is_staff ? [{ to:"/admin", label:"Panel admin", icon:"⊕" }] : []),
                    ].map(({to,label,icon}) => (
                      <Link key={to} to={to} onClick={()=>setUserOpen(false)} style={{
                        display:"flex", alignItems:"center", gap:"10px",
                        padding:"9px 12px", borderRadius:"10px",
                        fontSize:"13px", color:"var(--text-2)",
                        textDecoration:"none", transition:"background 120ms",
                      }}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                      >
                        <span style={{ fontSize:"11px", color:"var(--text-3)", width:"14px" }}>{icon}</span>
                        {label}
                      </Link>
                    ))}
                    <div style={{ borderTop:"1px solid var(--border)", margin:"6px 0 2px" }} />
                    <button onClick={()=>{logout();navigate("/");setUserOpen(false)}} style={{
                      width:"100%", display:"flex", alignItems:"center", gap:"10px",
                      padding:"9px 12px", borderRadius:"10px",
                      fontSize:"13px", color:"var(--text-3)",
                      background:"none", border:"none", cursor:"pointer",
                      textAlign:"left", transition:"background 120ms", fontFamily:"inherit",
                    }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    >
                      <span style={{ fontSize:"11px", width:"14px" }}>↗</span>
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <Link to="/login" style={{
                  padding:"8px 16px", borderRadius:"var(--r-full)", fontSize:"14px",
                  color:`rgba(255,255,255,${linkA})`,
                  background:"transparent", border:"1px solid transparent",
                  textDecoration:"none", transition:"color 150ms, border-color 150ms",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor="rgba(255,255,255,0.2)"}}
                  onMouseLeave={e=>{e.currentTarget.style.color=`rgba(255,255,255,${linkA})`;e.currentTarget.style.borderColor="transparent"}}
                >
                  Iniciar sesión
                </Link>
                <Link to="/register" style={{
                  padding:"8px 18px", borderRadius:"var(--r-full)", fontSize:"14px",
                  fontWeight:500, color:"#000", background:"#efefef",
                  textDecoration:"none", letterSpacing:"-0.01em",
                  transition:"background 150ms, transform 150ms",
                  display:"inline-block",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.transform="scale(0.97)"}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#efefef";e.currentTarget.style.transform="scale(1)"}}
                >
                  Registrarse gratis
                </Link>
              </div>
            )}
          </div>

          {/* Hamburger — solo mobile */}
          <button id="lp-hamburger" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"
            style={{
              display:"none", width:"38px", height:"38px", borderRadius:"10px",
              background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
              color:"#fff", alignItems:"center", justifyContent:"center",
              cursor:"pointer", flexShrink:0,
            }}>
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path d="M1 1H17M1 7H17M1 13H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      <style>{`
        @media (max-width: 860px) {
          .lp-nav-desktop { display: none !important; }
          #lp-hamburger   { display: flex !important; }
        }
      `}</style>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop:"1px solid var(--border)", background:"var(--bg)", marginTop:"auto" }}>
      <div style={{
        maxWidth:"var(--container, 1200px)", margin:"0 auto",
        padding:"clamp(56px,8vw,88px) clamp(20px,5vw,60px) clamp(36px,5vw,56px)",
      }}>
        <div style={{
          display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr",
          gap:"clamp(28px,5vw,56px)", marginBottom:"clamp(40px,6vw,64px)",
        }} className="lp-footer-grid">

          {/* Brand */}
          <div>
            <img src={logoImg} alt="LevelPro Audio" style={{
              height:"22px", objectFit:"contain",
              filter:"brightness(0) invert(1)", marginBottom:"18px",
            }} />
            <p style={{ fontSize:"14px", color:"var(--text-3)", lineHeight:1.75, maxWidth:"280px" }}>
              Equipamiento de audio profesional para músicos, productores y estudios en Chile y Argentina.
            </p>
            <div style={{ display:"flex", gap:"10px", marginTop:"22px" }}>
              {[
                { href:"https://instagram.com/levelproar", path:"M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                { href:"https://wa.me/5492622635045",      path:"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" },
              ].map(({ href, path }) => (
                <a key={href} href={href} target="_blank" rel="noreferrer" style={{
                  width:"34px", height:"34px", borderRadius:"50%",
                  border:"1px solid var(--border)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"var(--text-3)", transition:"all 150ms",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--text-3)";e.currentTarget.style.color="var(--text)"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-3)"}}
                >
                  <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                    <path d={path}/>
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Columnas */}
          {[
            { title:"Tienda",    links:[
              {label:"Todos los productos", to:"/shop"},
              {label:"Micrófonos",           to:"/shop?category=microfonos"},
              {label:"Interfaces de audio",  to:"/shop?category=interfaces"},
              {label:"Auriculares",          to:"/shop?category=auriculares"},
            ]},
            { title:"Plataforma", links:[
              {label:"Academia",  to:"/academy"},
              {label:"Servicios", to:"/services"},
              {label:"Mi cuenta", to:"/dashboard"},
            ]},
            { title:"Contacto",  links:[
              {label:"WhatsApp",       href:"https://wa.me/5492622635045"},
              {label:"Instagram",      href:"https://instagram.com/levelproar"},
              {label:"Iniciar sesión", to:"/login"},
            ]},
          ].map(({ title, links }) => (
            <div key={title}>
              <p style={{ fontSize:"11px", fontWeight:600, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"18px" }}>
                {title}
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {links.map(({ label, to, href }) =>
                  href ? (
                    <a key={label} href={href} target="_blank" rel="noreferrer"
                      style={{ fontSize:"14px", color:"var(--text-3)", textDecoration:"none", transition:"color 150ms" }}
                      onMouseEnter={e=>e.currentTarget.style.color="var(--text)"}
                      onMouseLeave={e=>e.currentTarget.style.color="var(--text-3)"}>{label}</a>
                  ) : (
                    <Link key={to} to={to}
                      style={{ fontSize:"14px", color:"var(--text-3)", textDecoration:"none", transition:"color 150ms" }}
                      onMouseEnter={e=>e.currentTarget.style.color="var(--text)"}
                      onMouseLeave={e=>e.currentTarget.style.color="var(--text-3)"}>{label}</Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{
          paddingTop:"24px", borderTop:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between",
          alignItems:"center", flexWrap:"wrap", gap:"12px",
        }}>
          <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
            © 2026 LevelPro Audio. Todos los derechos reservados.
          </p>
          <div style={{ display:"flex", gap:"20px" }}>
            {["Términos","Privacidad"].map(item => (
              <span key={item} style={{ fontSize:"13px", color:"var(--text-3)", cursor:"default", transition:"color 150ms" }}
                onMouseEnter={e=>e.currentTarget.style.color="var(--text)"}
                onMouseLeave={e=>e.currentTarget.style.color="var(--text-3)"}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .lp-footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .lp-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────
// MainLayout
// ─────────────────────────────────────────────────────────────
export default function MainLayout({ children }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)" }}>
      <Navbar />
      <main style={{ flex:1, paddingTop:"72px" }}>
        {children}
      </main>
      <Footer />
    </div>
  )
}
