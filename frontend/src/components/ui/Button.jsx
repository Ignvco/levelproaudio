// components/ui/Button.jsx
//
// Sistema global de botones de LevelPro. Dos variantes visuales fieles
// a los mockups de marca:
//   - variant="green"  → fondo verde, texto blanco, círculo blanco + flecha verde (CTA principales)
//   - variant="light"  → fondo blanco, texto verde, círculo verde + flecha blanca (secundarios / sobre fondo oscuro)
//
// El círculo con flecha es OPCIONAL (prop `arrow`): se usa en CTA y
// acciones principales; los botones utilitarios pueden ir sin él.
//
// Sigue el patrón de los botones del proyecto: acepta `to` (Link),
// `href` (anchor) o es <button>. Toda la lógica existente (onClick,
// type, disabled, etc.) pasa por ...rest, así migrar no rompe nada.

import { Link } from "react-router-dom"
import { ArrowRight, Loader2 } from "lucide-react"

// Keyframe del spinner (autocontenido, se inyecta una sola vez)
if (typeof document !== "undefined" && !document.getElementById("lp-btn-spin")) {
  const st = document.createElement("style")
  st.id = "lp-btn-spin"
  st.textContent = "@keyframes lp-spin { to { transform: rotate(360deg) } }"
  document.head.appendChild(st)
}

// Tamaños — mismo ADN visual, solo cambian proporciones.
const SIZES = {
  sm: { padY: "8px",  padL: "18px", padR: "8px",  font: "13px",   circle: 30, gap: "16px", icon: 15 },
  md: { padY: "11px", padL: "26px", padR: "11px", font: "15px",   circle: 40, gap: "24px", icon: 18 },
  lg: { padY: "14px", padL: "34px", padR: "14px", font: "17px",   circle: 52, gap: "34px", icon: 22 },
}

// Cuando NO hay flecha, el padding derecho iguala al izquierdo (pill simétrico)
function paddings(size, hasArrow) {
  const s = SIZES[size] || SIZES.md
  return {
    padding: hasArrow
      ? `${s.padY} ${s.padR} ${s.padY} ${s.padL}`
      : `${s.padY} ${s.padL}`,
  }
}

export default function Button({
  variant = "green",       // "green" | "light"
  size = "md",             // "sm" | "md" | "lg"
  arrow = false,           // muestra el círculo con flecha
  loading = false,
  disabled = false,
  to, href, children, testId, className, style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md
  const isLight = variant === "light"
  const isDisabled = disabled || loading

  // Colores por variante (usan el verde dedicado de botones, --btn-green)
  const colors = isLight
    ? { bg: "#ffffff", text: "var(--btn-green)", circleBg: "var(--btn-green)", arrowColor: "#ffffff" }
    : { bg: "var(--btn-green)", text: "#ffffff", circleBg: "#ffffff", arrowColor: "var(--btn-green)" }

  const rootStyle = {
    display: "inline-flex", alignItems: "center", justifyContent: "space-between",
    gap: s.gap,
    ...paddings(size, arrow),
    background: colors.bg,
    color: colors.text,
    border: "none",
    borderRadius: "9999px",
    fontFamily: "var(--font-sans)",
    fontSize: s.font,
    fontWeight: 600,
    lineHeight: 1,
    textDecoration: "none",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    whiteSpace: "nowrap",
    userSelect: "none",
    transition: "transform 200ms cubic-bezier(.2,.8,.2,1), filter 200ms var(--ease), box-shadow 200ms var(--ease)",
    WebkitTapHighlightColor: "transparent",
    ...style,
  }

  // El círculo con la flecha (o el spinner de loading, del mismo tamaño)
  const circle = (arrow || loading) ? (
    <span data-btn-circle style={{
      flexShrink: 0, width: `${s.circle}px`, height: `${s.circle}px`,
      borderRadius: "50%", background: colors.circleBg,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      transition: "transform 240ms cubic-bezier(.2,.8,.2,1)",
    }}>
      {loading
        ? <Loader2 size={s.icon} color={colors.arrowColor} style={{ animation: "lp-spin 800ms linear infinite" }} />
        : <ArrowRight size={s.icon} color={colors.arrowColor} />}
    </span>
  ) : null

  // Interacciones: hover levanta apenas + mueve el círculo/flecha; active comprime
  const onEnter = (e) => {
    if (isDisabled) return
    e.currentTarget.style.transform = "translateY(-1px)"
    e.currentTarget.style.filter = "brightness(0.97)"
    const c = e.currentTarget.querySelector("[data-btn-circle]")
    if (c) c.style.transform = "translateX(3px)"
  }
  const onLeave = (e) => {
    e.currentTarget.style.transform = "translateY(0)"
    e.currentTarget.style.filter = "none"
    const c = e.currentTarget.querySelector("[data-btn-circle]")
    if (c) c.style.transform = "translateX(0)"
  }
  const onDown = (e) => { if (!isDisabled) e.currentTarget.style.transform = "translateY(0) scale(0.98)" }
  const onUp   = (e) => { if (!isDisabled) e.currentTarget.style.transform = "translateY(-1px)" }

  const handlers = { onMouseEnter: onEnter, onMouseLeave: onLeave, onMouseDown: onDown, onMouseUp: onUp }

  const content = <>
    <span>{children}</span>
    {circle}
  </>

  const cls = `lp-btn ${className || ""}`.trim()

  // Link interno
  if (to && !isDisabled) {
    return <Link to={to} className={cls} style={rootStyle} data-testid={testId} {...handlers} {...rest}>{content}</Link>
  }
  // Link externo
  if (href && !isDisabled) {
    return <a href={href} className={cls} style={rootStyle} data-testid={testId} {...handlers} {...rest}>{content}</a>
  }
  // Botón
  return (
    <button className={cls} style={rootStyle} disabled={isDisabled}
      data-testid={testId} {...handlers} {...rest}>
      {content}
    </button>
  )
}
