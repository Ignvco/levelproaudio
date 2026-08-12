// pages/legal/Terminos.jsx — Términos y Condiciones
import LegalShell from "../../components/legal/LegalShell"

const SECTIONS = [
  {
    id: "empresa", title: "Información de la empresa",
    body: [
      "Este sitio web y los servicios asociados son operados por LevelPro Audio SpA, sociedad constituida en Chile, RUT 78.217.935-7, en adelante \"LevelPro Audio\".",
      "Cualquier consulta relacionada con estos Términos y Condiciones, o con la operación del sitio, puede dirigirse a través de los canales oficiales de contacto disponibles en la Plataforma, incluyendo el correo electrónico ventas@levelproaudio.com.",
    ],
  },
  {
    id: "aceptacion", title: "Aceptación de los términos",
    body: [
      "Al acceder y utilizar el sitio web y los servicios de LevelPro Audio (\"la Plataforma\"), aceptás quedar vinculado por estos Términos y Condiciones. Si no estás de acuerdo con alguna de las condiciones, te pedimos que no utilices la Plataforma.",
      "Estos términos aplican a todos los visitantes, usuarios registrados y clientes que realicen compras de productos, cursos o servicios a través de LevelPro Audio.",
    ],
  },
  {
    id: "cuenta", title: "Registro y cuenta de usuario",
    body: [
      "Para acceder a ciertas funciones (compras, academia, sorteos) necesitás crear una cuenta con datos verídicos y actualizados. Sos responsable de mantener la confidencialidad de tu contraseña y de toda la actividad que ocurra en tu cuenta.",
      "Podés recuperar el acceso mediante el flujo de recuperación de contraseña. Notificanos de inmediato ante cualquier uso no autorizado de tu cuenta.",
    ],
  },
  {
    id: "productos", title: "Productos, precios y disponibilidad",
    body: [
      "Los productos, cursos y servicios se muestran con la mayor precisión posible. Sin embargo, los precios, descripciones y disponibilidad de stock pueden cambiar sin previo aviso.",
      "Los precios se expresan según la moneda indicada en cada página. En operaciones que involucren conversión de divisas, el tipo de cambio aplicado será el vigente al momento de procesar el pago.",
      "LevelPro Audio se reserva el derecho de limitar cantidades, rechazar o cancelar pedidos ante errores evidentes de precio, sospecha de fraude o falta de stock.",
    ],
  },
  {
    id: "pagos", title: "Pagos",
    body: [
      "Los pagos se procesan a través de proveedores externos (MercadoPago y PayPal, entre otros). LevelPro Audio no almacena los datos completos de tu tarjeta.",
      "El pedido se confirma únicamente una vez que el proveedor de pago aprueba la transacción. Recibirás un email de confirmación en cada compra aprobada.",
    ],
  },
  {
    id: "envios", title: "Envíos y entregas",
    body: [
      "Realizamos envíos dentro de Chile y Argentina. Los plazos y costos de envío se informan durante el proceso de compra y pueden variar según la ubicación y el operador logístico.",
      "Los tiempos de entrega son estimados y pueden verse afectados por factores externos (aduanas, transportistas, feriados).",
    ],
  },
  {
    id: "cambios", title: "Cambios y devoluciones",
    body: [
      "De acuerdo con la normativa de protección al consumidor de Chile y Argentina, contás con derecho a retracto sobre productos físicos dentro de los plazos legales establecidos, siempre que el producto se encuentre sin uso y en su empaque original.",
      "Los cursos y contenidos digitales, una vez habilitado el acceso, pueden no ser reembolsables. Contactanos para gestionar cualquier solicitud de cambio o devolución.",
    ],
  },
  {
    id: "propiedad", title: "Propiedad intelectual",
    body: [
      "Todo el contenido de la Plataforma (marca, logotipos, textos, cursos, videos, diseño e imágenes) es propiedad de LevelPro Audio o de sus licenciantes y está protegido por las leyes de propiedad intelectual.",
      "No está permitido reproducir, distribuir ni comercializar el contenido de la academia sin autorización expresa y por escrito.",
    ],
  },
  {
    id: "responsabilidad", title: "Limitación de responsabilidad",
    body: [
      "La Plataforma se ofrece \"tal cual\". En la máxima medida permitida por la ley, LevelPro Audio no será responsable por daños indirectos derivados del uso o la imposibilidad de uso de la Plataforma.",
      "Nada en estos términos limita los derechos que la ley reconoce a los consumidores.",
    ],
  },
  {
    id: "modificaciones", title: "Modificaciones y ley aplicable",
    body: [
      "Podemos actualizar estos Términos y Condiciones en cualquier momento. La versión vigente será siempre la publicada en esta página, con su fecha de última actualización.",
      "Estos términos se rigen por las leyes aplicables en Chile y Argentina según corresponda al lugar de la operación.",
    ],
  },
]

export default function Terminos() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Términos y Condiciones"
      updated="Julio 2026"
      seoDescription="Términos y Condiciones de uso de LevelPro Audio: compras, pagos, envíos, cambios y devoluciones en Chile y Argentina."
      intro="Estos Términos y Condiciones regulan el uso de la plataforma LevelPro Audio y la compra de productos, cursos y servicios. Te recomendamos leerlos con atención antes de utilizar nuestros servicios."
      sections={SECTIONS}
    />
  )
}
