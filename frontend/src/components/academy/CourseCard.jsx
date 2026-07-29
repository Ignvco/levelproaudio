// components/academy/CourseCard.jsx
// Card de curso estilo "folder tab" (referencia cliente).
import { Link } from "react-router-dom"
import { mediaUrl } from "../../utils/mediaUrl"
import { useScrollReveal } from "../../hooks/useScrollReveal"

const LEVELS = {
  beginner:     "Principiante",
  intermediate: "Intermedio",
  advanced:     "Avanzado",
}

export default function CourseCard({ course, index = 0 }) {
  const ref = useScrollReveal({ delay: index * 80 })

  const levelLabel = course.level_display || LEVELS[course.level] || course.level || "Curso"
  const lessons    = course.total_lessons || 0
  const lessonsStr = String(lessons).padStart(2, "0")
  const subtitle   = course.short_description || levelLabel
  const thumb      = course.thumbnail || course.thumbnail_url

  return (
    <Link ref={ref} to={`/academy/${course.slug}`}
      className="folder-card"
      data-testid={`course-card-${course.slug}`}>

      {/* Banner */}
      <div className="folder-card__img">
        {thumb ? (
          <img src={mediaUrl(thumb)} alt={course.title} />
        ) : (
          <div className="folder-card__img-fallback" aria-hidden="true" />
        )}
        <div className="folder-card__brand">
          <span>{levelLabel}</span>
          <span>Academia</span>
        </div>
      </div>

      {/* Panel folder */}
      <div className="folder-card__panel">
        <div className="folder-card__tab">
          <p className="folder-card__title" data-testid={`course-title-${course.slug}`}>
            {course.title}
          </p>
          <p className="folder-card__subtitle">{subtitle}</p>
        </div>

        <div className="folder-card__stats">
          <div data-testid={`course-lessons-${course.slug}`}>
            <span className="folder-card__num">{lessonsStr}</span>
            <span className="folder-card__num-unit">
              {lessons === 1 ? "Lección" : "Lecciones"}
            </span>
          </div>
          <p
            className={`folder-card__price${course.is_free ? " folder-card__price--free" : ""}`}
            data-testid={`course-price-${course.slug}`}>
            {course.is_free ? "Gratis" : `$${Number(course.price).toLocaleString("es-CL")}`}
          </p>
        </div>
      </div>
    </Link>
  )
}
