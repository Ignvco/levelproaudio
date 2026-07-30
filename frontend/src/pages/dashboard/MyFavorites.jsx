// pages/dashboard/MyFavorites.jsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useEffect } from "react"
import { Heart } from "lucide-react"
import { getFavorites } from "../../api/favorites.api"
import ProductCard from "../../components/product/ProductCard"
import { useFavoritesStore } from "../../store/favoritesStore"

export default function MyFavorites() {
  const loadFavs = useFavoritesStore(s => s.load)
  const favIds   = useFavoritesStore(s => s.ids)
  useEffect(() => { loadFavs() }, [loadFavs])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-favorites"], queryFn: getFavorites,
  })

  // Al cambiar favoritos (quitar desde la card), refrescar la lista
  useEffect(() => { refetch() }, [favIds.length, refetch])

  const products = (data?.results || []).filter(p => favIds.includes(p.id))

  return (
    <div style={{ padding: "clamp(32px, 5vw, 56px)", maxWidth: "1100px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
          Guardados
        </p>
        <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
          Mis favoritos
        </h1>
      </div>

      {isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "24px" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "420px", borderRadius: "26px" }} />
          ))}
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <div style={{ background: "#121212", border: "1px solid var(--border)",
          borderRadius: "22px", padding: "64px 32px", textAlign: "center" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.2)",
            color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px" }}><Heart size={26} /></div>
          <h3 className="display-bold" style={{ fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "1.4rem", letterSpacing: "-0.02em", marginBottom: "8px" }}>
            Todavía no guardaste favoritos
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-3)", marginBottom: "28px" }}>
            Tocá el corazón en cualquier producto para guardarlo acá.
          </p>
          <Link to="/shop" className="btn btn-accent">Explorar tienda →</Link>
        </div>
      )}

      {!isLoading && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "24px" }}>
          {products.map(p => (
            <div key={p.id} data-testid={`fav-item-${p.slug}`}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
