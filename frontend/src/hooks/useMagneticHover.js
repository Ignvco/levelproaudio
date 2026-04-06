// hooks/useMagneticHover.js
import { useEffect, useRef } from "react"

export function useMagneticHover(strength = 0.3) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onMouseMove = (e) => {
      const rect   = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top  + rect.height / 2
      const dx = (e.clientX - centerX) * strength
      const dy = (e.clientY - centerY) * strength
      el.style.transform   = `translate(${dx}px, ${dy}px)`
      el.style.transition  = "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)"
    }

    const onMouseLeave = () => {
      el.style.transform  = "translate(0, 0)"
      el.style.transition = "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)"
    }

    el.addEventListener("mousemove", onMouseMove)
    el.addEventListener("mouseleave", onMouseLeave)
    return () => {
      el.removeEventListener("mousemove", onMouseMove)
      el.removeEventListener("mouseleave", onMouseLeave)
    }
  }, [])

  return ref
}