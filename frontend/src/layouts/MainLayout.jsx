// layouts/MainLayout.jsx — Floating pill navbar (desktop) + Bottom dock (mobile)
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { useAuthStore } from "../store/authStore"
import { useCartStore } from "../store/cartStore"
import { getCategories } from "../api/products.api"
import logoImg from "../assets/logo.png"
import { useSiteSettings } from "../hooks/useSiteSettings"

const NAV_LINKS = [
  { label: "Tienda",    to: "/shop"     },
  { label: "Academia",  to: "/academy"  },
  { label: "Servicios", to: "/services" },
  { label: "Rewards",   to: "/rewards"  },
]

// ─────────────────────────────────────────────────────────────
// SVG icons
// ─────────────────────────────────────────────────────────────
function NavIcon({ name, size = 20, filled = false }) {
  const paths = {
    home:   filled
      ? "M12 2.1L1 12h3v9h6v-6h4v6h6v-9h3z"
      : "M3 12l9-9 9 9 M5 10v10h5v-6h4v6h5V10",
    search: "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35",
    bag:    "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0",
    cart:   "M6 6h15l-1.5 9h-13z M6 6L4 2H1 M9 21a1 1 0 100-2 1 1 0 000 2z M18 21a1 1 0 100-2 1 1 0 000 2z",
    grad:   "M22 10L12 4 2 10l10 6 10-6z M6 12v5c3 3 9 3 12 0v-5",
    user:   "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    arrow:  "M5 12h14 M12 5l7 7-7 7",
    tools:  "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
    sliders:"M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M2 14h4 M10 8h4 M18 16h4",
    gift:   "M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z",
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={filled ? 0 : 2}
      strokeLinecap="round" strokeLinejoin="round">
      {paths[name].split(" M").map((p, i) => (
        <path key={i} d={i === 0 ? p : `M${p}`} />
      ))}
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════
// Desktop Navbar — Floating dark pill centered at top
// ═════════════════════════════════════════════════════════════
// Arma el árbol padre → hijas a partir del listado plano que devuelve
// la API — así el menú refleja SIEMPRE las categorías reales del admin,
// sin tener que tocar código cada vez que se agrega una nueva.
// Categorías sin productos (ni propios ni de sus hijas) se ocultan,
// para no llevar a páginas de resultados vacías.
function buildCategoryTree(categories) {
  if (!categories?.length) return []
  const byParent = {}
  categories.forEach(c => {
    const key = c.parent || "root"
    if (!byParent[key]) byParent[key] = []
    byParent[key].push(c)
  })
  const withProducts = (cat) => {
    const children = byParent[cat.id] || []
    const childCount = children.reduce((sum, ch) => sum + ch.product_count, 0)
    return cat.product_count > 0 || childCount > 0
  }
  return (byParent.root || [])
    .filter(withProducts)
    .map(top => ({ ...top, children: (byParent[top.id] || []).filter(c => c.product_count > 0) }))
}

function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const { siteName, logoUrl } = useSiteSettings()
  const cartCount = useCartStore(s => s.getCount())
  const location  = useLocation()
  const navigate  = useNavigate()

  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef(null)
  const [shopOpen, setShopOpen] = useState(false)
  const shopCloseTimer = useRef(null)
  const navPillRef = useRef(null)

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"], queryFn: getCategories,
    staleTime: 5 * 60 * 1000, // el árbol no cambia seguido
  })
  const categoryTree = buildCategoryTree(categoriesData?.results || categoriesData || [])

  const openShopMenu  = () => { clearTimeout(shopCloseTimer.current); setShopOpen(true) }
  const closeShopMenu = () => { shopCloseTimer.current = setTimeout(() => setShopOpen(false), 150) }

  useEffect(() => {
    setUserOpen(false)
    setShopOpen(false)
  }, [location.pathname])

  // Cerrar el mega menu al hacer click afuera del navbar, o con Escape
  useEffect(() => {
    if (!shopOpen) return
    const onClickOutside = (e) => {
      if (navPillRef.current && !navPillRef.current.contains(e.target)) setShopOpen(false)
    }
    const onEscape = (e) => { if (e.key === "Escape") setShopOpen(false) }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEscape)
    }
  }, [shopOpen])

  useEffect(() => {
    const fn = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isHome = location.pathname === "/"
  const pillBg = scrolled ? "rgba(15,15,15,0.95)" : "rgba(15,15,15,0.85)"
  const sideElBase = {
    position: "fixed", top: "20px", zIndex: 100, height: "52px",
    display: "flex", alignItems: "center",
    background: pillBg,
    backdropFilter: "blur(20px) saturate(1.6)",
    WebkitBackdropFilter: "blur(20px) saturate(1.6)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "var(--r-full)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
    transition: "all var(--dur) var(--ease)",
  }

  return createPortal(
    <>
      {/* Scrim superior: al scrollear, el contenido se disuelve limpio bajo/alrededor de la píldora */}
      <div aria-hidden="true" style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "clamp(78px, 9vh, 104px)", zIndex: 99, pointerEvents: "none",
        background: "linear-gradient(to bottom, var(--bg) 32%, rgba(8,8,8,0.62) 64%, transparent 100%)",
        opacity: scrolled ? 1 : 0,
        transition: "opacity 320ms var(--ease)",
      }} />

      {/* Botón Volver (izquierda) — en todas menos la principal */}
      {!isHome && (
        <button onClick={() => navigate(-1)} data-testid="nav-back" aria-label="Volver"
          style={{ ...sideElBase, left: "24px", gap: "8px", padding: "0 20px 0 15px",
            color: "var(--text-2)", cursor: "pointer", fontSize: "14px", fontWeight: 600,
            fontFamily: "var(--font-sans)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={17} strokeWidth={2} /> Volver
        </button>
      )}

      {/* Logo plataforma (derecha) — en todas menos la principal */}
      {!isHome && (
        <Link to="/" data-testid="nav-logo-right" aria-label="Inicio"
          style={{ position: "fixed", top: "20px", right: "24px", zIndex: 100, height: "52px",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={logoUrl || logoImg} alt={siteName} style={{ height: "30px", objectFit: "contain",
            filter: "brightness(0) invert(1)", maxWidth: "160px" }} />
        </Link>
      )}
    <header
      ref={navPillRef}
      className="lp-navbar-desktop"
      style={{
        position:  "fixed",
        top:       "20px",
        left:      "50%",
        transform: "translateX(-50%)",
        zIndex:    100,
        width:     "auto",
      }}>
      <div style={{
        display:         "flex",
        alignItems:      "center",
        gap:             "6px",
        padding:         "6px 6px 6px 22px",
        background:      scrolled ? "rgba(15,15,15,0.95)" : "rgba(15,15,15,0.85)",
        backdropFilter:  "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border:          "1px solid rgba(255,255,255,0.08)",
        borderRadius:    shopOpen ? "var(--r-full) var(--r-full) 0 0" : "var(--r-full)",
        transition:      "background 320ms var(--ease), border-radius 240ms cubic-bezier(.2,.8,.2,1)",
        boxShadow: `
          0 20px 60px rgba(0,0,0,0.55),
          0 0 0 1px rgba(255,255,255,0.04) inset,
          0 -1px 0 rgba(0,0,0,0.4) inset
        `,
      }}>

        {/* Logo */}
        <Link to="/" data-testid="navbar-logo" style={{
          display: "flex", alignItems: "center",
          marginRight: "18px",
          flexShrink: 0,
        }}>
          <img src={logoUrl || logoImg} alt={siteName} style={{
            height: "22px", objectFit: "contain",
            filter: "brightness(0) invert(1)",
            maxWidth: "110px",
          }} />
        </Link>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {NAV_LINKS.map(item => {
            const isActive = location.pathname.startsWith(item.to)
            const isShop = item.to === "/shop"
            const linkEl = (
              <Link key={item.to}
                to={item.to}
                data-testid={`nav-${item.label.toLowerCase()}`}
                style={{
                  padding: "9px 16px", borderRadius: "var(--r-full)",
                  background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                  fontSize: "13.5px", fontWeight: 500,
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  transition: "background 180ms var(--ease), color 180ms var(--ease)",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)"
                    e.currentTarget.style.color = "#fff"
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.color = "rgba(255,255,255,0.75)"
                  }
                }}>
                {item.label}
              </Link>
            )

            if (!isShop || categoryTree.length === 0) return linkEl

            return (
              <div key={item.to}
                onMouseEnter={openShopMenu} onMouseLeave={closeShopMenu}>
                {linkEl}
              </div>
            )
          })}
        </nav>

        {/* Right side — cart + auth pill */}
        <div style={{ display: "flex", alignItems: "center",
          gap: "6px", marginLeft: "14px" }}>

          {/* Cart icon inside pill */}
          <Link to="/cart" data-testid="navbar-cart" style={{
            position: "relative",
            width: "36px", height: "36px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.75)",
            transition: "background 180ms var(--ease), color 180ms var(--ease)",
          }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)"
              e.currentTarget.style.color = "#fff"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = "rgba(255,255,255,0.75)"
            }}>
            <NavIcon name="cart" size={17} />
            {cartCount > 0 && (
              <span style={{
                position: "absolute", top: "3px", right: "3px",
                background: "var(--accent)", color: "#000",
                fontSize: "9px", fontWeight: 800,
                minWidth: "14px", height: "14px", borderRadius: "7px",
                padding: "0 3px",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid rgba(15,15,15,0.85)",
              }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>

          {/* Auth CTA — white pill (matching reference) */}
          {isAuthenticated ? (
            <div ref={userRef} style={{ position: "relative" }}>
              <button
                data-testid="navbar-avatar"
                onClick={() => setUserOpen(!userOpen)}
                style={{
                  padding: "8px 16px", borderRadius: "var(--r-full)",
                  background: userOpen ? "var(--accent)" : "#ffffff",
                  color: "#000",
                  border: "none", cursor: "pointer",
                  fontSize: "13px", fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  transition: "background 180ms var(--ease)",
                }}>
                <span style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: userOpen ? "#000" : "var(--accent)",
                  color: userOpen ? "var(--accent)" : "#000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px", fontWeight: 800,
                  fontFamily: "var(--font-sans)",
                }}>
                  {user?.first_name?.[0]?.toUpperCase() || "U"}
                </span>
                {user?.first_name || "Cuenta"}
              </button>
              {userOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  minWidth: "220px",
                  background: "rgba(15,15,15,0.95)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "var(--r-lg)",
                  padding: "8px",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
                  animation: "scaleIn 180ms var(--ease)",
                  transformOrigin: "top right",
                }}>
                  <div style={{ padding: "10px 12px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: "6px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                      {user?.first_name ? `${user.first_name} ${user.last_name||""}`.trim() : "Mi cuenta"}
                    </p>
                    <p style={{ fontSize: "11px",
                      color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>
                      {user?.email}
                    </p>
                  </div>
                  {[
                    { to: "/dashboard",         label: "Mi cuenta" },
                    { to: "/dashboard/orders",  label: "Pedidos"   },
                    { to: "/dashboard/courses", label: "Mis cursos"},
                    ...(user?.is_staff ? [{ to: "/admin", label: "Panel Admin" }] : []),
                  ].map(l => (
                    <Link key={l.to} to={l.to} onClick={() => setUserOpen(false)}
                      style={{
                        display: "block", padding: "9px 12px",
                        borderRadius: "var(--r-md)",
                        color: "rgba(255,255,255,0.85)", fontSize: "13px",
                        textDecoration: "none",
                        transition: "background 150ms",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {l.label}
                    </Link>
                  ))}
                  <button onClick={() => { logout(); navigate("/") }}
                    style={{
                      width: "100%", textAlign: "left", padding: "9px 12px",
                      borderRadius: "var(--r-md)",
                      color: "#ff6b6b", fontSize: "13px",
                      background: "transparent", border: "none",
                      cursor: "pointer", marginTop: "4px",
                      transition: "background 150ms",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,77,77,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" data-testid="navbar-login" style={{
                display: "inline-flex", alignItems: "center",
                padding: "9px 14px", borderRadius: "var(--r-full)",
                background: "transparent",
                color: "rgba(255,255,255,0.75)",
                fontSize: "13px", fontWeight: 500,
                textDecoration: "none",
                fontFamily: "var(--font-sans)",
                transition: "color 180ms var(--ease), background 180ms var(--ease)",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = "#fff"
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.75)"
                  e.currentTarget.style.background = "transparent"
                }}>
                Ingresar
              </Link>
              <Link to="/register"
                data-testid="navbar-cta"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "9px 18px", borderRadius: "var(--r-full)",
                  background: "#ffffff", color: "#000",
                  fontSize: "13px", fontWeight: 500,
                  textDecoration: "none", letterSpacing: "-0.01em",
                  fontFamily: "var(--font-sans)",
                  transition: "transform 200ms var(--ease), background 200ms var(--ease)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "var(--accent)"
                  e.currentTarget.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "#ffffff"
                  e.currentTarget.style.transform = "translateY(0)"
                }}>
                Empezar
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mega menu — anclado al wrapper completo del navbar (no a un
          item individual), mismo ancho real que el pill, integrado
          visualmente sin costura (radios que se completan entre sí). */}
      {categoryTree.length > 0 && (
        <div
          onMouseEnter={openShopMenu} onMouseLeave={closeShopMenu}
          style={{
            position: "absolute", top: "calc(100% - 1px)", left: 0, width: "100%",
            background: "rgba(10,10,10,0.97)",
            backdropFilter: "blur(22px) saturate(1.4)",
            WebkitBackdropFilter: "blur(22px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,0.07)", borderTop: "none",
            borderRadius: "0 0 var(--r-2xl) var(--r-2xl)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
            padding: "clamp(28px, 3vw, 40px) clamp(28px, 4vw, 48px) clamp(32px, 3.4vw, 46px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 200px))",
            gap: "16px 40px",
            justifyContent: "start",
            opacity: shopOpen ? 1 : 0,
            visibility: shopOpen ? "visible" : "hidden",
            transform: shopOpen ? "translateY(0)" : "translateY(-6px)",
            transition: "opacity 240ms cubic-bezier(.2,.8,.2,1), transform 240ms cubic-bezier(.2,.8,.2,1), visibility 240ms",
            pointerEvents: shopOpen ? "auto" : "none",
            zIndex: 99,
          }}>
          {categoryTree.map(cat => (
            <div key={cat.id}>
              <Link to={`/shop?category=${cat.slug}`}
                style={{ display: "block", fontSize: "11.5px", fontWeight: 700,
                  color: "var(--accent)", textTransform: "uppercase",
                  letterSpacing: "0.07em", textDecoration: "none", marginBottom: "14px" }}>
                {cat.name}
              </Link>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {cat.children.length > 0
                  ? cat.children.map(ch => (
                    <Link key={ch.id} to={`/shop?category=${ch.slug}`}
                      style={{ fontSize: "14px", color: "rgba(255,255,255,0.70)",
                        textDecoration: "none", padding: "6px 8px", margin: "0 -8px",
                        borderRadius: "8px",
                        transition: "background 160ms var(--ease), color 160ms var(--ease), transform 160ms var(--ease)" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = "#fff"
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)"
                        e.currentTarget.style.transform = "translateX(2px)"
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = "rgba(255,255,255,0.70)"
                        e.currentTarget.style.background = "transparent"
                        e.currentTarget.style.transform = "translateX(0)"
                      }}>
                      {ch.name}
                    </Link>
                  ))
                  : (
                    <Link to={`/shop?category=${cat.slug}`}
                      style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)",
                        textDecoration: "none", padding: "6px 8px", margin: "0 -8px",
                        borderRadius: "8px" }}>
                      Ver todo
                    </Link>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
    </>,
    document.body
  )
}

// ═════════════════════════════════════════════════════════════
// Mobile Bottom Dock — floating pill w/ icons
// ═════════════════════════════════════════════════════════════
function MobileDock() {
  const location = useLocation()
  const { siteName, logoUrl } = useSiteSettings()
  const { isAuthenticated, user } = useAuthStore()
  const cartCount = useCartStore(s => s.getCount())

  const items = [
    { to: "/",         icon: "home",   label: "Home"     },
    { to: "/shop",     icon: "bag",    label: "Tienda"   },
    { to: "/academy",  icon: "grad",   label: "Academia" },
    { to: "/services", icon: "sliders",label: "Servicios"},
    { to: "/rewards",  icon: "gift",   label: "Rewards"  },
    { to: "/cart",     icon: "cart",   label: "Carrito", badge: cartCount },
    {
      to: isAuthenticated ? "/dashboard" : "/login",
      icon: "user", label: "Cuenta",
      avatar: isAuthenticated ? (user?.first_name?.[0]?.toUpperCase() || "U") : null,
    },
  ]

  return createPortal(
    <>
    {/* Logo fijo arriba al centro — visible en mobile excepto en Home (Home tiene su logo en el hero) */}
    {location.pathname !== "/" && (
    <Link to="/" data-testid="mobile-logo-top" aria-label="Inicio"
      style={{
        position: "fixed", top: "18px", left: "50%",
        transform: "translateX(-50%)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
      <img src={logoUrl || logoImg} alt={siteName} style={{
        height: "34px", objectFit: "contain",
        filter: "brightness(0) invert(1)", maxWidth: "190px",
      }} />
    </Link>
    )}
    <div
      className="lp-mobile-dock"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "16px",
        transform: "translateX(-50%)",
        zIndex: 100,
      }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "1px",
        padding: "6px 7px",
        background: "rgba(15,15,15,0.9)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "var(--r-full)",
        boxShadow: `
          0 24px 60px rgba(0,0,0,0.6),
          0 0 0 1px rgba(255,255,255,0.04) inset
        `,
      }}>
        {items.map(item => {
          const isActive = item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              data-testid={`dock-${item.icon}`}
              style={{
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "44px", height: "44px", borderRadius: "50%",
                color: isActive ? "#000" : "#fff",
                background: isActive ? "var(--accent)" : "transparent",
                opacity: isActive ? 1 : 0.85,
                boxShadow: isActive ? "0 4px 16px rgba(26,255,110,0.4)" : "none",
                transition: "all 200ms var(--ease)",
                textDecoration: "none",
              }}>
              {item.avatar ? (
                <span style={{
                  width: "22px", height: "22px", borderRadius: "50%",
                  background: isActive ? "#000" : "rgba(255,255,255,0.18)",
                  color: isActive ? "var(--accent)" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px", fontWeight: 800,
                  fontFamily: "var(--font-sans)",
                }}>
                  {item.avatar}
                </span>
              ) : (
                <NavIcon name={item.icon} size={21} filled={isActive && item.icon === "home"} />
              )}
              {item.badge > 0 && (
                <span style={{
                  position: "absolute", top: "2px", right: "2px",
                  minWidth: "18px", height: "18px", borderRadius: "9px",
                  padding: "0 4px",
                  background: "var(--accent)", color: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px", fontWeight: 800,
                  border: "2px solid rgba(15,15,15,0.9)",
                }}>
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
    </>,
    document.body
  )
}

// ═════════════════════════════════════════════════════════════
// Footer (preservado del layout anterior)
// ═════════════════════════════════════════════════════════════
function Footer() {
  const { whatsappUrl, instagramUrl, contactEmail, siteName, logoUrl } = useSiteSettings()
  return (
    <footer style={{ background:"var(--bg)", marginTop:"auto",
      borderTop:"1px solid var(--border)" }}>
      <div style={{
        maxWidth:"var(--container-max, 1440px)", margin:"0 auto",
        padding:"88px var(--container-pad, clamp(20px,4vw,64px)) 64px",
      }}>
        <div style={{
          display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr",
          columnGap:"64px", rowGap:"40px", marginBottom:"clamp(40px,6vw,64px)",
        }} className="lp-footer-grid">

          {/* Brand */}
          <div>
            <img src={logoUrl || logoImg} alt={siteName} style={{
              height:"22px", objectFit:"contain",
              filter:"brightness(0) invert(1)", marginBottom:"18px",
            }} />
            <p style={{ fontSize:"14px", color:"var(--text-3)", lineHeight:1.75, maxWidth:"280px" }}>
              Equipamiento de audio profesional para músicos, productores y estudios en Chile y Argentina.
            </p>
            <div style={{ display:"flex", gap:"10px", marginTop:"22px" }}>
              {[
                { href:instagramUrl, path:"M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                { href:whatsappUrl,      path:"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" },
              ].map(({ href, path }) => (
                <a key={href} href={href} target="_blank" rel="noreferrer" style={{
                  width:"34px", height:"34px", borderRadius:"50%",
                  border:"1px solid var(--border)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"var(--text-3)", transition:"all 150ms",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--text-3)";e.currentTarget.style.color="var(--text)"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-3)"}}>
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
              {label:"Rewards",   to:"/rewards"},
              {label:"Mi cuenta", to:"/dashboard"},
            ]},
            { title:"Contacto",  links:[
              {label:"WhatsApp",       href:whatsappUrl},
              {label:"Instagram",      href:instagramUrl},
              {label:contactEmail,     href:`mailto:${contactEmail}`},
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
            © {new Date().getFullYear()} {siteName}. Todos los derechos reservados.
          </p>
          <div style={{ display:"flex", gap:"20px", alignItems:"center", flexWrap:"wrap" }}>
            {[
              { label:"Términos",        to:"/terminos"     },
              { label:"Privacidad",      to:"/privacidad"   },
              { label:"Garantía y cambios", to:"/garantia"  },
              { label:"Bases del Sorteo", to:"/bases-sorteo" },
            ].map(item => (
              <Link key={item.to} to={item.to} data-testid={`footer-legal-${item.to.replace("/","")}`}
                style={{ fontSize:"13px", color:"var(--text-3)", textDecoration:"none", transition:"color 150ms" }}
                onMouseEnter={e=>e.currentTarget.style.color="var(--text)"}
                onMouseLeave={e=>e.currentTarget.style.color="var(--text-3)"}>
                {item.label}
              </Link>
            ))}
            <Link to="/admin/login" data-testid="footer-admin-link" style={{
              fontSize:"12px", color:"var(--text-3)",
              textDecoration:"none",
              display:"inline-flex", alignItems:"center", gap:"6px",
              padding:"5px 12px", borderRadius:"var(--r-full)",
              border:"1px solid var(--border)",
              transition:"all 150ms",
            }}
              onMouseEnter={e=>{
                e.currentTarget.style.color = "var(--accent)"
                e.currentTarget.style.borderColor = "rgba(26,255,110,0.3)"
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.color = "var(--text-3)"
                e.currentTarget.style.borderColor = "var(--border)"
              }}>
              <span style={{ width:"6px", height:"6px", borderRadius:"50%",
                background:"var(--accent)" }} />
              Panel Admin
            </Link>
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

// ═════════════════════════════════════════════════════════════
// MainLayout — responsive con detección de viewport via JS
// ═════════════════════════════════════════════════════════════
export default function MainLayout({ children }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth <= 900
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)" }}>
      {isMobile ? <MobileDock /> : <Navbar />}
      <main style={{ flex:1, paddingTop:"0", paddingBottom: isMobile ? "100px" : "0" }}>
        {children}
      </main>
      <Footer />
    </div>
  )
}
