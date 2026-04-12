// hooks/useScrollReveal.js
import { useEffect, useRef } from "react"

export function useScrollReveal(options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

     // Verificar si ya está en el viewport ANTES de inicializar
     const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight) {
      el.style.opacity = "1"
      el.style.transform = "none"
      el.style.transition = "none"
      return
    }

    const inView = rect.top < window.innerHeight && rect.bottom > 0

    // Si ya está visible, mostrar sin animación
    if (inView) {
      el.style.opacity   = "1"
      el.style.transform = "none"
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity    = "1"
          el.style.transform  = "translateY(0) scale(1)"
          observer.unobserve(el)
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || "0px 0px -60px 0px",
      }
    )

    

    // Estado inicial
     // Ocultar para animar al entrar
    el.style.opacity = "0"
    el.style.transform = scaleIn ? "scale(0.95)" : "translateY(24px)"
    el.style.transition = `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`



    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

export default useScrollReveal