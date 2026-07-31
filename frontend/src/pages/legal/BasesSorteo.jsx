// pages/legal/BasesSorteo.jsx — Bases y Condiciones del Sorteo (LevelPro Rewards)
import LegalShell from "../../components/legal/LegalShell"

const SECTIONS = [
  {
    id: "organizador", title: "Organizador",
    body: [
      "El sorteo \"LevelPro Rewards\" es organizado por LevelPro Audio (\"el Organizador\"). La participación implica el conocimiento y la aceptación total de estas Bases y Condiciones.",
    ],
  },
  {
    id: "participacion", title: "Cómo participar",
    body: [
      "La participación se realiza mediante la compra de stickers (tickets) de la campaña activa a través de la Plataforma. Cada sticker adquirido otorga un código único de participación.",
      "Podés adquirir la cantidad de stickers que desees mientras la campaña esté vigente. Cuantos más stickers tengas, más chances de resultar ganador.",
      "Los códigos de participación se envían por email y quedan disponibles en tu cuenta, en la sección \"Mis participaciones\".",
    ],
  },
  {
    id: "requisitos", title: "Requisitos de participación",
    body: [
      "Para participar debés:",
      [
        "Ser mayor de 18 años.",
        "Residir en Chile o Argentina.",
        "Tener una cuenta registrada y activa en LevelPro Audio.",
        "Haber completado correctamente el pago de al menos un sticker de la campaña.",
      ],
      "No podrán participar empleados del Organizador ni sus familiares directos.",
    ],
  },
  {
    id: "vigencia", title: "Vigencia y fecha del sorteo",
    body: [
      "Cada campaña tiene una fecha de inicio y una fecha de sorteo (draw date) informadas en la página de la campaña. Solo participan los stickers adquiridos y pagados antes de la fecha límite indicada.",
    ],
  },
  {
    id: "premio", title: "Premio",
    body: [
      "El premio de cada campaña es el producto indicado en la página del sorteo. El premio no es transferible ni canjeable por dinero en efectivo, salvo que el Organizador disponga lo contrario.",
      "En caso de imposibilidad de entregar el premio anunciado, el Organizador podrá reemplazarlo por otro de igual o mayor valor.",
    ],
  },
  {
    id: "seleccion", title: "Selección del ganador",
    body: [
      "El ganador se determinará mediante un sorteo aleatorio entre todos los códigos de participación válidos, en la fecha indicada para cada campaña.",
      "El resultado se registra en la Plataforma y el ganador será notificado por email y/o por los canales de contacto de LevelPro Audio.",
    ],
  },
  {
    id: "notificacion", title: "Notificación y entrega del premio",
    body: [
      "El ganador deberá responder a la notificación dentro de los 7 días corridos y acreditar su identidad y datos de contacto.",
      "Si el ganador no responde en el plazo estipulado o no cumple con los requisitos, el Organizador podrá seleccionar un nuevo ganador.",
      "La coordinación de entrega o envío del premio se realizará de común acuerdo con el ganador.",
    ],
  },
  {
    id: "datos", title: "Uso de datos e imagen",
    body: [
      "Los datos personales se tratan conforme a nuestra Política de Privacidad. El ganador autoriza al Organizador a difundir su nombre y, de mediar su consentimiento, su imagen, con fines de comunicación del resultado del sorteo, sin derecho a compensación adicional.",
    ],
  },
  {
    id: "generales", title: "Disposiciones generales",
    body: [
      "El Organizador podrá modificar, suspender o cancelar la campaña ante causas de fuerza mayor o razones ajenas a su voluntad, informándolo por los canales oficiales.",
      "Cualquier situación no prevista en estas Bases será resuelta por el Organizador de manera razonable y conforme a la legislación vigente en Chile y Argentina.",
    ],
  },
]

export default function BasesSorteo() {
  return (
    <LegalShell
      eyebrow="LevelPro Rewards"
      title="Bases y Condiciones del Sorteo"
      updated="Julio 2026"
      seoDescription="Bases y Condiciones del sorteo LevelPro Rewards: cómo participar, requisitos, premios y selección del ganador."
      intro="Estas Bases y Condiciones regulan la participación en los sorteos de LevelPro Rewards. Al adquirir stickers de una campaña, aceptás en su totalidad las condiciones aquí descriptas."
      sections={SECTIONS}
    />
  )
}
