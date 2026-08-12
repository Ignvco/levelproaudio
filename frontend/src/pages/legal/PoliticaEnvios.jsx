// pages/legal/PoliticaEnvios.jsx — Política de Envíos y Despachos
import LegalShell from "../../components/legal/LegalShell"

const SECTIONS = [
  {
    id: "cobertura", title: "1. Cobertura de envíos",
    body: [
      "LevelPro Audio realiza envíos dentro de Chile y Argentina.",
      "Para determinados productos importados o adquiridos especialmente a solicitud del cliente, las condiciones de envío se informan previamente cuando corresponde.",
    ],
  },
  {
    id: "plazos-costos", title: "2. Plazos y costos",
    body: [
      "Los plazos y costos de envío se calculan e informan durante el proceso de compra, antes de confirmar el pedido, según la dirección de destino y el operador logístico correspondiente.",
      "Los plazos son estimados y pueden variar según la ubicación, la disponibilidad del producto y factores del operador logístico ajenos a LevelPro Audio.",
    ],
  },
  {
    id: "preparacion", title: "3. Preparación del pedido",
    body: [
      "Una vez confirmado el pago, el pedido pasa a preparación. El cliente recibe notificaciones por email sobre el estado de su pedido: compra recibida, pedido en preparación, pedido despachado y pedido entregado.",
      "Cuando el despacho lo permite, se proporciona un número de seguimiento para que el cliente pueda hacer el seguimiento del envío.",
    ],
  },
  {
    id: "recepcion", title: "4. Recepción y revisión",
    body: [
      "Al recibir el pedido, recomendamos revisar el estado del embalaje y del producto.",
      "Si el producto presenta daños visibles derivados del transporte, recomendamos informarlo lo antes posible, idealmente con fotografías del embalaje exterior, embalaje interior y producto, para gestionar la solución correspondiente.",
    ],
  },
  {
    id: "incidencias", title: "5. Producto incorrecto o pedido incompleto",
    body: [
      "Si el pedido recibido no corresponde a lo solicitado, o presenta faltantes atribuibles a un error de preparación o despacho, el cliente debe comunicarse con LevelPro Audio para gestionar la solución.",
      "Para el detalle sobre cambios, devoluciones y garantía, se puede consultar nuestra Política de Garantía, Cambios y Devoluciones.",
    ],
  },
  {
    id: "contacto", title: "6. Contacto",
    body: [
      "Para cualquier consulta relacionada con un envío, el cliente puede comunicarse con LevelPro Audio a través de los canales oficiales de atención disponibles en el sitio web.",
    ],
  },
]

export default function PoliticaEnvios() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Política de Envíos"
      updated="Agosto 2026"
      seoDescription="Política de envíos de LevelPro Audio: cobertura en Chile y Argentina, plazos y costos calculados en el checkout, seguimiento del pedido y gestión de incidencias de transporte."
      intro="En LevelPro Audio buscamos que tu pedido llegue de forma clara y ordenada. La presente política describe cómo funcionan nuestros envíos, plazos, costos y la gestión de cualquier incidencia durante el transporte."
      sections={SECTIONS}
    />
  )
}
