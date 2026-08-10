// pages/legal/PoliticaGarantia.jsx — Política de Garantía, Cambios y Devoluciones
import LegalShell from "../../components/legal/LegalShell"

const SECTIONS = [
  {
    id: "garantia", title: "1. Garantía de los productos",
    body: [
      "Los productos comercializados por LevelPro Audio cuentan con la garantía oficial correspondiente del fabricante, de acuerdo con las condiciones, plazos y limitaciones establecidos por cada marca.",
      "LevelPro Audio no otorga una garantía comercial adicional, salvo que expresamente se indique lo contrario en la descripción del producto, comprobante de compra o documentación correspondiente.",
      "En caso de presentarse una falla o inconveniente con un producto dentro del período de garantía, el cliente deberá comunicarse con LevelPro Audio para iniciar el proceso correspondiente.",
    ],
  },
  {
    id: "gestion-garantia", title: "¿Cómo gestionamos una garantía?",
    body: [
      "LevelPro Audio podrá solicitar información, fotografías, videos, números de serie, comprobante de compra u otros antecedentes necesarios para realizar una evaluación inicial del caso.",
      "Dependiendo de la naturaleza del inconveniente, el producto podrá requerir una revisión técnica para determinar si la falla corresponde a una condición cubierta por la garantía del fabricante.",
      "Una vez determinada la procedencia de la garantía, LevelPro Audio orientará y acompañará al cliente durante el proceso correspondiente con el fabricante, distribuidor o servicio técnico autorizado, según corresponda.",
      "La resolución final de una garantía estará sujeta a las condiciones establecidas por el fabricante y a la legislación aplicable.",
    ],
  },
  {
    id: "exclusiones", title: "2. Exclusiones de garantía",
    body: [
      "La garantía del fabricante puede no cubrir daños o fallas ocasionados por, entre otros: uso incorrecto o contrario a las instrucciones del fabricante; instalación incorrecta; manipulación, modificación o reparación no autorizada; daños físicos ocasionados por golpes, caídas o accidentes; daños provocados por líquidos, humedad, electricidad o condiciones ambientales inadecuadas; sobrecargas, conexiones incorrectas o utilización de componentes incompatibles; desgaste normal derivado del uso; daños ocasionados por transporte cuando este no corresponda a una responsabilidad de LevelPro Audio o del transportista contratado por LevelPro Audio; y cualquier otra condición excluida expresamente por la garantía del fabricante.",
      "Estas exclusiones se aplicarán siempre dentro de los límites permitidos por la legislación vigente.",
    ],
  },
  {
    id: "cambios-devoluciones", title: "3. Cambios y devoluciones",
    body: [
      "Los cambios y devoluciones se gestionarán de acuerdo con la legislación vigente aplicable a la operación y al país en que se efectúe la compra, además de las condiciones específicas informadas para cada producto o servicio.",
      "Cuando corresponda legalmente un cambio, devolución, retracto, desistimiento o solución equivalente, LevelPro Audio gestionará el procedimiento de acuerdo con la normativa aplicable.",
      "En aquellos casos en que la legislación no establezca un derecho de devolución o cambio por mera voluntad del cliente, LevelPro Audio no estará obligado a aceptar cambios o devoluciones que no hayan sido previamente autorizados.",
    ],
  },
  {
    id: "producto-defectuoso", title: "4. Producto defectuoso",
    body: [
      "Si el cliente recibe un producto que presenta una falla, defecto o funcionamiento anormal, deberá comunicarse con LevelPro Audio a la brevedad posible.",
      "Para agilizar la evaluación, podremos solicitar: número de pedido o comprobante de compra; número de serie del producto; fotografías o videos del inconveniente; descripción detallada de la falla; información sobre las condiciones de instalación y uso; y otros antecedentes que resulten necesarios para evaluar el caso.",
      "El producto podrá requerir una revisión técnica antes de determinar la solución correspondiente.",
    ],
  },
  {
    id: "producto-incorrecto", title: "5. Producto incorrecto o pedido incompleto",
    body: [
      "Si LevelPro Audio envía un producto diferente al solicitado, o si el pedido presenta faltantes atribuibles a un error de preparación o despacho, el cliente deberá comunicarse con nosotros para gestionar la solución correspondiente.",
      "En estos casos, LevelPro Audio evaluará los antecedentes del pedido y coordinará las acciones necesarias para corregir el inconveniente.",
    ],
  },
  {
    id: "danos-transporte", title: "6. Daños ocasionados durante el transporte",
    body: [
      "Cuando un producto presente daños visibles o aparentes derivados del transporte, recomendamos informar el inconveniente lo antes posible, idealmente proporcionando fotografías del embalaje exterior, embalaje interior y producto.",
      "En caso de que el despacho haya sido gestionado por LevelPro Audio, evaluaremos el caso y realizaremos las gestiones correspondientes con el transportista cuando proceda.",
    ],
  },
  {
    id: "productos-importados", title: "7. Productos importados o adquiridos especialmente para el cliente",
    body: [
      "Determinados productos pueden ser adquiridos, importados o gestionados especialmente a solicitud del cliente. Las condiciones particulares de estos productos serán informadas previamente cuando corresponda.",
      "La condición de producto importado o adquirido especialmente no limita los derechos que la legislación aplicable otorgue al consumidor.",
    ],
  },
  {
    id: "productos-usados", title: "8. Productos usados, modificados o manipulados",
    body: [
      "Para efectos de evaluación de una garantía o devolución, el producto podrá ser revisado para determinar su estado y las circunstancias del inconveniente.",
      "La manipulación, modificación, reparación o intervención técnica realizada por personas o servicios no autorizados puede afectar la cobertura de la garantía del fabricante, cuando dicha exclusión sea aplicable conforme a sus condiciones y a la legislación vigente.",
    ],
  },
  {
    id: "proceso-atencion", title: "9. Proceso de atención",
    body: [
      "Para solicitar asistencia relacionada con una garantía, cambio o devolución, el cliente deberá comunicarse con LevelPro Audio utilizando los canales oficiales de atención disponibles en nuestro sitio web.",
      "Cada solicitud será evaluada individualmente considerando: la naturaleza del inconveniente; el producto involucrado; la fecha y condiciones de compra; las condiciones de garantía del fabricante; la documentación y antecedentes proporcionados; y la legislación aplicable a la operación.",
    ],
  },
  {
    id: "cumplimiento-legal", title: "10. Cumplimiento de la legislación vigente",
    body: [
      "Esta política no tiene por objeto limitar, excluir ni renunciar a los derechos que correspondan al consumidor conforme a la legislación vigente.",
      "En caso de existir una diferencia entre esta política y una disposición legal de carácter obligatorio aplicable a la operación, prevalecerá la disposición legal correspondiente.",
    ],
  },
]

export default function PoliticaGarantia() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Política de Garantía, Cambios y Devoluciones"
      updated="Agosto 2026"
      seoDescription="Política de garantía, cambios y devoluciones de LevelPro Audio: garantía del fabricante, exclusiones, proceso de atención ante fallas o productos defectuosos."
      intro="En LevelPro Audio nos comprometemos a entregar productos de calidad y a brindar orientación y acompañamiento a nuestros clientes durante y después de su compra. La presente política establece las condiciones aplicables a garantías, cambios y devoluciones de los productos comercializados por LevelPro Audio."
      sections={SECTIONS}
    />
  )
}
