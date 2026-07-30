// components/product/FavoriteButton.jsx — corazón para guardar favoritos
import { Heart } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useFavoritesStore } from "../../store/favoritesStore"
import { useAuthStore } from "../../store/authStore"
import { showToast } from "../ui/ToastNotification"

export function FavoriteButton({ productId, slug, size = 38, variant = "overlay" }) {
  const navigate = useNavigate()
  const isFav    = useFavoritesStore(s => s.ids.includes(productId))
  const toggle   = useFavoritesStore(s => s.toggle)
  const isAuth   = useAuthStore(s => s.isAuthenticated)

  const onClick = async (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!isAuth) {
      showToast("Iniciá sesión para guardar favoritos", "error")
      navigate("/login")
      return
    }
    const res = await toggle(productId)
    if (res?.favorited) showToast("Agregado a favoritos")
    else if (res && !res.error && !res.needAuth) showToast("Quitado de favoritos")
    else if (res?.error) showToast("No se pudo actualizar", "error")
  }

  const base = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: `${size}px`, height: `${size}px`, borderRadius: "50%",
    cursor: "pointer", flexShrink: 0,
    transition: "transform 200ms var(--ease), background 200ms var(--ease), color 200ms var(--ease)",
  }
  const styles = variant === "overlay"
    ? { ...base, background: "rgba(20,20,20,0.72)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: isFav ? "var(--accent)" : "#fff" }
    : { ...base, background: "var(--surface-2)", border: "1px solid var(--border)",
        color: isFav ? "var(--accent)" : "var(--text-3)" }

  return (
    <button data-testid={`fav-btn-${slug}`} onClick={onClick}
      aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
      style={styles}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)" }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)" }}>
      <Heart size={size * 0.44} strokeWidth={2}
        fill={isFav ? "currentColor" : "none"} />
    </button>
  )
}
