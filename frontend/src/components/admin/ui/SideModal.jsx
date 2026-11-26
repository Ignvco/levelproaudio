// components/admin/ui/SideModal.jsx — LevelPro Precision SideModal (Tiendanube / Nimbus v1.8.1)
import { useEffect, useId, useRef } from "react"
import { X } from "lucide-react"

export function SideModal({
  open: openProp,
  isOpen: isOpenProp,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  maxWidth = 580,
  testId = "side-modal",
  children,
}) {
  const open = openProp ?? isOpenProp
  const titleId = useId()
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()

    const handleKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (e.key !== "Tab") return
      const candidates = [...(panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || [])]
      if (!candidates.length) {
        e.preventDefault()
        panelRef.current?.focus()
        return
      }
      const first = candidates[0]
      const last = candidates[candidates.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="admin-portal-root lp-drawer-backdrop"
      onClick={onClose}
      data-testid={testId}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(9, 9, 11, 0.45)",
        zIndex: 1100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="lp-sidemodal"
        style={{
          width: typeof maxWidth === "number" ? `min(${maxWidth}px, 100vw)` : maxWidth,
          height: "100%",
          background: "#FFFFFF",
          borderLeft: "1px solid #E4E4E7",
          boxShadow: "0 20px 48px -12px rgba(9, 9, 11, 0.18), 0 0 0 1px rgba(9, 9, 11, 0.06)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid #E4E4E7",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
            background: "#FFFFFF",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {subtitle && (
              <div style={{ fontSize: 11.5, color: "#71717A", marginBottom: 3, fontWeight: 500 }}>
                {subtitle}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2
                id={titleId}
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#09090B",
                  margin: 0,
                  letterSpacing: "-0.015em",
                }}
              >
                {title}
              </h2>
              {headerExtra}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel lateral"
            data-testid={`${testId}-close`}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "1px solid #E4E4E7",
              background: "#FFFFFF",
              color: "#52525B",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid #E4E4E7",
              background: "#FAFAFA",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
