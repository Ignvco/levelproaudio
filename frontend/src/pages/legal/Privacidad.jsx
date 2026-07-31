// pages/legal/Privacidad.jsx — Políticas de Privacidad
import LegalShell from "../../components/legal/LegalShell"

const SECTIONS = [
  {
    id: "intro", title: "Responsable del tratamiento",
    body: [
      "LevelPro Audio es responsable del tratamiento de los datos personales que recopila a través de esta Plataforma. Esta política explica qué datos recopilamos, con qué finalidad y cuáles son tus derechos.",
    ],
  },
  {
    id: "datos", title: "Datos que recopilamos",
    body: [
      "Recopilamos los siguientes datos cuando interactuás con la Plataforma:",
      [
        "Datos de identificación y contacto: nombre, email, teléfono.",
        "Datos de envío: dirección, ciudad, provincia y código postal.",
        "Datos de compra: productos, cursos y servicios adquiridos.",
        "Datos técnicos: dirección IP, tipo de dispositivo y navegación, mediante cookies.",
      ],
      "No almacenamos los datos completos de tus medios de pago; estos son gestionados por los proveedores de pago.",
    ],
  },
  {
    id: "finalidad", title: "Finalidad del tratamiento",
    body: [
      "Utilizamos tus datos para:",
      [
        "Procesar y gestionar tus compras, envíos e inscripciones.",
        "Enviarte comunicaciones transaccionales (confirmaciones, tickets de sorteo, recuperación de contraseña).",
        "Brindarte soporte y atención al cliente.",
        "Mejorar la Plataforma y, con tu consentimiento, enviarte novedades y promociones.",
      ],
    ],
  },
  {
    id: "legitimacion", title: "Base legal",
    body: [
      "El tratamiento se basa en la ejecución del contrato de compraventa, en tu consentimiento (para comunicaciones comerciales) y en el cumplimiento de obligaciones legales y fiscales.",
    ],
  },
  {
    id: "terceros", title: "Compartir datos con terceros",
    body: [
      "Compartimos datos únicamente con proveedores necesarios para operar el servicio: pasarelas de pago (MercadoPago, PayPal), operadores logísticos y proveedores de envío de emails.",
      "Estos terceros solo acceden a la información imprescindible y están obligados a proteger tus datos. No vendemos tus datos personales.",
    ],
  },
  {
    id: "cookies", title: "Cookies",
    body: [
      "Utilizamos cookies propias y de terceros para el funcionamiento del sitio, recordar tu sesión y analizar el uso de la Plataforma. Podés configurar tu navegador para rechazar cookies, aunque esto puede afectar algunas funciones.",
    ],
  },
  {
    id: "conservacion", title: "Conservación de los datos",
    body: [
      "Conservamos tus datos mientras tu cuenta esté activa y durante los plazos legales aplicables (por ejemplo, obligaciones contables y fiscales). Luego se eliminan o anonimizan de forma segura.",
    ],
  },
  {
    id: "derechos", title: "Tus derechos",
    body: [
      "Podés ejercer tus derechos de acceso, rectificación, actualización, supresión y oposición al tratamiento de tus datos, así como revocar tu consentimiento en cualquier momento.",
      "Para ejercerlos, escribinos por los canales de contacto indicados al pie de esta página.",
    ],
  },
  {
    id: "seguridad", title: "Seguridad",
    body: [
      "Aplicamos medidas técnicas y organizativas para proteger tus datos, incluyendo conexiones cifradas y almacenamiento seguro de credenciales. Ningún sistema es 100% infalible, pero trabajamos para minimizar los riesgos.",
    ],
  },
]

export default function Privacidad() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Políticas de Privacidad"
      updated="Julio 2026"
      seoDescription="Política de Privacidad de LevelPro Audio: qué datos recopilamos, cómo los usamos y cuáles son tus derechos."
      intro="Tu privacidad es importante para nosotros. En esta política te explicamos de forma clara qué información recopilamos, para qué la utilizamos y cómo podés ejercer tus derechos sobre tus datos personales."
      sections={SECTIONS}
    />
  )
}
