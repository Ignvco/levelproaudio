// components/ui/CustomCursor.jsx
import { useEffect, useRef, useState } from "react"

export default function CustomCursor() {
  const dotRef   = useRef(null)
  const ringRef  = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)
  const pos = useRef({ x: -100, y: -100 })
  const ring = useRef({ x: -100, y: -100 })
  const rafId = useRef(null)

  useEffect(() => {
    // Solo en desktop
    if (window.matchMedia("(pointer: coarse)").matches) return

    const moveDot = (e) => {
      pos.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseDown = () => setClicked(true)
    const onMouseUp   = () => setClicked(false)

    const onEnterInteractive = () => setHovered(true)
    const onLeaveInteractive = () => setHovered(false)

    // Animar el ring con lag
    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.12
      ring.current.y += (pos.current.y - ring.current.y) * 0.12

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pos.current.x - 4}px, ${pos.current.y - 4}px)`
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.current.x - 20}px, ${ring.current.y - 20}px)`
      }

      rafId.current = requestAnimationFrame(animate)
    }

    animate()

    document.addEventListener("mousemove", moveDot)
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("mouseup",   onMouseUp)

    // Detectar elementos interactivos
    const interactives = document.querySelectorAll("a, button, [data-cursor]")
    interactives.forEach(el => {
      el.addEventListener("mouseenter", onEnterInteractive)
      el.addEventListener("mouseleave", onLeaveInteractive)
    })

    // Observer para nuevos elementos
    const mutObs = new MutationObserver(() => {
      document.querySelectorAll("a:not([data-cursor-bound]), button:not([data-cursor-bound])")
        .forEach(el => {
          el.setAttribute("data-cursor-bound", "true")
          el.addEventListener("mouseenter", onEnterInteractive)
          el.addEventListener("mouseleave", onLeaveInteractive)
        })
    })
    mutObs.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(rafId.current)
      document.removeEventListener("mousemove", moveDot)
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("mouseup",   onMouseUp)
      mutObs.disconnect()
    }
  }, [])

  // No renderizar en touch
  if (typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches) {
    return null
  }

  return (
    <>
      {/* Dot central */}
      <div ref={dotRef} style={{
        position:      "fixed",
        top:           0,
        left:          0,
        width:         "8px",
        height:        "8px",
        borderRadius:  "50%",
        background:    hovered ? "var(--accent)" : "var(--text)",
        zIndex:        99999,
        pointerEvents: "none",
        transition:    "width 200ms, height 200ms, background 200ms",
        mixBlendMode:  "difference",
        willChange:    "transform",
        ...(clicked && { width: "6px", height: "6px" }),
      }} />

      {/* Ring exterior */}
      <div ref={ringRef} style={{
        position:      "fixed",
        top:           0,
        left:          0,
        width:         hovered ? "48px" : "40px",
        height:        hovered ? "48px" : "40px",
        borderRadius:  "50%",
        border:        `1.5px solid ${hovered ? "var(--accent)" : "rgba(255,255,255,0.3)"}`,
        zIndex:        99998,
        pointerEvents: "none",
        transition:    "width 300ms, height 300ms, border-color 200ms, opacity 200ms",
        willChange:    "transform",
        opacity:       clicked ? 0.5 : 1,
        mixBlendMode:  "difference",
      }} />

      {/* Ocultar cursor nativo */}
      <style>{`
        @media (pointer: fine) {
          * { cursor: none !important; }
        }
      `}</style>
    </>
  )
}