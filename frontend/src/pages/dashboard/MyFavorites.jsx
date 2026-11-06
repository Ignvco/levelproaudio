// pages/dashboard/MyFavorites.jsx — LevelPro Dashboard Experience V2 (Usuario / Favoritos)
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { Heart, Package, Zap, Tag } from "lucide-react"
import { getFavorites } from "../../api/favorites.api"
import ProductCard from "../../components/product/ProductCard"
import { useFavoritesStore } from "../../store/favoritesStore"
import {
  AdminPageHeader,
  StatCard,
  PrimaryButton,
  SecondaryButton,
  ErrorState,
} from "../../components/admin/ui"

export default function MyFavorites() {
  const loadFavs = useFavoritesStore(s => s.load)
  const favIds   = useFavoritesStore(s => s.ids || [])
  useEffect(() => { loadFavs() }, [loadFavs])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-favorites"],
    queryFn: getFavorites,
  })

  // Al cambiar favoritos (quitar desde la card), refrescar la lista
  useEffect(() => { refetch() }, [favIds.length, refetch])

  const rawProducts = data?.results ?? data
  const allProducts = Array.isArray(rawProducts) ? rawProducts : []
  const products = allProducts.filter(p => favIds.includes(p.id))

  const inStockCount = products.filter(p => (Number(p.stock) || 0) > 0).length
  const discountedCount = products.filter(p => {
    const hasCompare = p.compare_price && Number(p.compare_price) > Number(p.price)
    const dropped = p.price_when_added && Number(p.price) < Number(p.price_when_added)
    return hasCompare || dropped
  }).length

  return (
    <div className="au-page" data-testid="favorites-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / MI CUENTA"
        title="Mis favoritos"
        description={isLoading || isError ? "Tu selección personal de productos" : `${products.length} producto${products.length !== 1 ? "s" : ""} guardado${products.length !== 1 ? "s" : ""} en tu lista de deseos`}
        breadcrumbs={[
          { label: "Inicio", to: "/dashboard" },
          { label: "Favoritos" },
        ]}
        actions={
          <PrimaryButton to="/shop" size="sm">
            Explorar catálogo
          </PrimaryButton>
        }
      />

      {/* Totales solo cuando la consulta se completó. */}
      {!isLoading && !isError && <div className="lp-grid-kpi">
        <StatCard
          variant="ink"
          Icon={Heart}
          label="Guardados"
          value={products.length}
          sub="En tu lista de deseos"
        />
        <StatCard
          variant="primary"
          Icon={Package}
          label="Stock disponible"
          value={inStockCount}
          sub="Con unidades disponibles"
        />
        <StatCard
          variant="light"
          Icon={Tag}
          label="Ofertas / Rebajados"
          value={discountedCount}
          sub="Con precio especial"
        />
      </div>}

      {!isLoading && isError && (
        <ErrorState title="No pudimos cargar tus favoritos"
          description="Tu lista sigue guardada. Puedes reintentar la consulta."
          action={<SecondaryButton onClick={() => refetch()}>Reintentar</SecondaryButton>} />
      )}

      {isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "380px", borderRadius: "20px" }} />
          ))}
        </div>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <div className="au-card" style={{ padding: "64px 24px", textAlign: "center" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "rgba(26, 255, 110, 0.1)",
              border: "1px solid rgba(26, 255, 110, 0.25)",
              color: "var(--admin-primary-text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Heart size={26} />
          </div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.35rem", marginBottom: "8px" }}>
            Aún no tienes productos guardados
          </h3>
          <p style={{ fontSize: "13.5px", color: "var(--admin-text-secondary)", marginBottom: "24px", maxWidth: "420px", margin: "0 auto 24px" }}>
            Haz clic en el icono de corazón en cualquier interfaz, micrófono o monitor para agregarlo a tu lista.
          </p>
          <PrimaryButton to="/shop">
            Explorar catálogo de la tienda →
          </PrimaryButton>
        </div>
      )}

      {!isLoading && !isError && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
          {products.map(p => {
            const priceDropped = p.price_when_added && Number(p.price) < Number(p.price_when_added)
            return (
              <div key={p.id} data-testid={`fav-item-${p.slug || p.id}`} style={{ position: "relative" }}>
                {priceDropped && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      left: "12px",
                      zIndex: 3,
                      padding: "4px 10px",
                      borderRadius: "100px",
                      background: "var(--admin-primary)",
                      color: "#00160b",
                      fontSize: "11px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    <Zap size={11} /> Bajó de ${Number(p.price_when_added).toLocaleString("es-CL")}
                  </div>
                )}
                <ProductCard product={p} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
