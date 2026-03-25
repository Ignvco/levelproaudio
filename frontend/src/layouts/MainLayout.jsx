// layouts/MainLayout.jsx
// Layout principal con Navbar y Footer
// Todas las páginas públicas usan este layout

import { useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { useCartStore } from "../store/cartStore"

// ── Navbar ─────────────────────────────────────────────────
function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false)
   const cartCount = useCartStore(state =>
    state.items.reduce((acc, i) => acc + i.quantity, 0)
)
const { isAuthenticated, user, logout } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate("/")
    }

    const navLinks = [
        { to: "/", label: "Inicio" },
        { to: "/shop", label: "Tienda" },
        { to: "/academy", label: "Academia" },
        { to: "/services", label: "Servicios" },
    ]

    return (
        <header
            style={{
                backgroundColor: "var(--color-surface)",
                borderBottom: "1px solid var(--color-border)",
            }}
            className="sticky top-0 z-50"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <span
                            className="text-xl font-black tracking-tight"
                            style={{ color: "var(--color-accent)" }}
                        >
                            LEVEL<span style={{ color: "var(--color-text)" }}>PRO</span>
                        </span>
                        <span
                            className="text-xs font-medium tracking-widest uppercase"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Audio
                        </span>
                    </Link>

                    {/* Nav links — desktop */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map(({ to, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === "/"}
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? "text-[var(--color-accent)] bg-[var(--color-surface-2)]"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                    }`
                                }
                            >
                                {label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Acciones derecha */}
                    <div className="flex items-center gap-3">

                        {/* Carrito */}
                        <Link
                            to="/cart"
                            className="relative p-2 rounded-lg transition-colors"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            {cartCount > 0 && (
                                <span
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                                    style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
                                >
                                    {cartCount}
                                </span>
                            )}
                        </Link>

                        {/* Auth */}
                        {isAuthenticated ? (
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/dashboard"
                                    className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                                    style={{
                                        color: "var(--color-accent)",
                                        border: "1px solid var(--color-accent)"
                                    }}
                                >
                                    {user?.first_name || "Mi cuenta"}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                                    style={{ color: "var(--color-text-muted)" }}
                                >
                                    Salir
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                                style={{
                                    backgroundColor: "var(--color-accent)",
                                    color: "#000",
                                }}
                            >
                                Ingresar
                            </Link>
                        )}

                        {/* Hamburger — mobile */}
                        <button
                            className="md:hidden p-2"
                            style={{ color: "var(--color-text-muted)" }}
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {menuOpen
                                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                }
                            </svg>
                        </button>

                    </div>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div
                        className="md:hidden py-3 border-t"
                        style={{ borderColor: "var(--color-border)" }}
                    >
                        {navLinks.map(({ to, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === "/"}
                                onClick={() => setMenuOpen(false)}
                                className="block px-4 py-3 text-sm font-medium"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                {label}
                            </NavLink>
                        ))}
                    </div>
                )}
            </div>
        </header>
    )
}

// ── Footer ──────────────────────────────────────────────────
function Footer() {
    return (
        <footer
            className="mt-auto py-10 border-t"
            style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
            }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <span
                        className="text-lg font-black tracking-tight"
                        style={{ color: "var(--color-accent)" }}
                    >
                        LEVEL<span style={{ color: "var(--color-text)" }}>PRO</span>
                        <span
                            className="text-xs font-medium ml-1"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Audio
                        </span>
                    </span>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        © 2026 LevelPro Audio. Todos los derechos reservados.
                    </p>
                    <div className="flex gap-4"><a
                        href="https://instagram.com/levelproar"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm transition-colors hover:text-white"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        Instagram
                    </a>
                        <a
                            href="https://wa.me/5492622635045"
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm transition-colors hover:text-white"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}

// ── Layout principal ────────────────────────────────────────
export default function MainLayout({ children }) {
    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ backgroundColor: "var(--color-bg)" }}
        >
            <Navbar />
            <main className="flex-1">
                {children}
            </main>
            <Footer />
        </div>
    )
}