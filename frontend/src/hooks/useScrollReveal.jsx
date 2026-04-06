// hooks/useScrollReveal.js
import { useEffect, useRef } from "react"

export function useScrollReveal(options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity    = "1"
          el.style.transform  = "translateY(0) scale(1)"
          observer.unobserve(el)
        }
      },
      {
        threshold: options.threshold || 0.15,
        rootMargin: options.rootMargin || "0px 0px -60px 0px",
      }
    )

    // Estado inicial
    el.style.opacity    = "0"
    el.style.transform  = options.slideUp
      ? "translateY(40px)"
      : options.scaleIn
      ? "scale(0.95) translateY(20px)"
      : "translateY(24px)"
    el.style.transition = `
      opacity ${options.duration || 700}ms cubic-bezier(0.16, 1, 0.3, 1) ${options.delay || 0}ms,
      transform ${options.duration || 700}ms cubic-bezier(0.16, 1, 0.3, 1) ${options.delay || 0}ms
    `

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}