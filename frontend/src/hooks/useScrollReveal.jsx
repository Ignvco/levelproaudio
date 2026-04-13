// hooks/useScrollReveal.js
// Fix crítico: si el elemento ya está en el viewport al montar,
// NO lo oculta — lo muestra directamente sin animación.
// Esto evita el bug de secciones negras en Home y otras páginas.

import { useEffect, useRef } from "react"

export function useScrollReveal({ delay = 0, scaleIn = false } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0

    // Si ya está visible, no ocultar — mostrar directamente
    if (inViewport) {
      el.style.opacity    = "1"
      el.style.transform  = "none"
      el.style.transition = "none"
      return
    }

    // Fuera del viewport: ocultar para animar al entrar
    el.style.opacity    = "0"
    el.style.transform  = scaleIn ? "scale(0.95) translateY(12px)" : "translateY(24px)"
    el.style.transition = `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms,
                           transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.style.opacity   = "1"
        el.style.transform = "none"
        observer.disconnect()
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay, scaleIn])

  return ref
}

export default useScrollReveal