// components/services/ServiceCard.jsx
// Card de servicio estilo "profile card" (referencia cliente).
import { Link } from "react-router-dom"
import { BadgeCheck, Clock, Tag, Plus } from "lucide-react"
import { mediaUrl } from "../../utils/mediaUrl"
import { useScrollReveal } from "../../hooks/useScrollReveal"

export default function ServiceCard({ service, index = 0 }) {
  const ref = useScrollReveal({ delay: index * 80 })

  return (
    <Link ref={ref} to={`/services/${service.slug}`}
      className="profile-card"
      data-testid={`service-card-${service.slug}`}>

      {/* Imagen */}
      <div className="profile-card__img">
        {service.thumbnail ? (
          <img src={mediaUrl(service.thumbnail)} alt={service.name} />
        ) : (
          <div className="profile-card__img-fallback" aria-hidden="true" />
        )}
      </div>

      {/* Cuerpo */}
      <div className="profile-card__body">
        <div className="profile-card__name">
          <span className="profile-card__name-text" data-testid={`service-name-${service.slug}`}>
            {service.name}
          </span>
          <BadgeCheck className="profile-card__verified" size={20}
            fill="#1aff6e" color="#0d0d0d" strokeWidth={2.5}
            data-testid={`service-verified-${service.slug}`} />
        </div>

        {service.short_description && (
          <p className="profile-card__desc">{service.short_description}</p>
        )}

        <div className="profile-card__footer">
          <div className="profile-card__stats">
            {service.duration_hours > 0 && (
              <span className="profile-card__stat" data-testid={`service-duration-${service.slug}`}>
                <Clock size={15} /> {service.duration_hours}h
              </span>
            )}
            {(service.price_display || service.price) && (
              <span className="profile-card__stat" data-testid={`service-price-${service.slug}`}>
                <Tag size={15} /> {service.price_display || "A cotizar"}
              </span>
            )}
          </div>
          <span className="profile-card__btn" data-testid={`service-cta-${service.slug}`}>
            Ver más <Plus size={15} strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  )
}
