# apps/orders/logistics_pdf.py
"""
LEVELPRO OS V4.0 — GATE 10: REPORTLAB PDF GENERATORS (BF-25)
- LOG10-ACCEPT-01: Etiquetas logísticas con clasificación explícita y advertencia prominente
  'SIMULACIÓN QA — NO VÁLIDA PARA DESPACHO' cuando no provienen de courier LIVE autorizado.
- LOG10-ACCEPT-02: Manifiestos de despacho diarios deterministas (invariant=True), sin precios ni
  costos internos, con marca QA cuando el transportista es simulado.
"""

import hashlib
import io

from reportlab.graphics.barcode import code128
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _mask_address(addr: str) -> str:
    clean = (addr or "").strip()
    return clean[:80] if clean else "Destino reservado"


def classify_label_document(label_obj) -> dict:
    """
    LOG10-ACCEPT-01: Clasifica inequívocamente una etiqueta logística sin depender
    exclusivamente del prefijo del tracking.
    Nunca clasifica una etiqueta simulada o interna como 'real_carrier_api'.
    """
    shp = label_obj.shipment
    carrier = shp.carrier if shp else None
    is_live_carrier = bool(carrier and carrier.integration_status == "live")
    is_courier_official = bool(
        is_live_carrier
        and label_obj.label_type == "courier_label"
        and not str(label_obj.tracking_number or "").startswith(("SIM-", "INT-"))
    )
    if is_courier_official:
        doc_class = "real_carrier_api"
    elif label_obj.label_type == "internal_logistic" and not carrier:
        doc_class = "internal_logistic"
    else:
        doc_class = "qa_simulation"

    return {
        "document_class": doc_class,
        "is_qa_simulation": doc_class != "real_carrier_api",
        "is_official_courier_label": doc_class == "real_carrier_api",
        "is_official_dte": False,
        "deducts_wms_inventory": False,
        "carrier_integration_status": carrier.integration_status if carrier else "internal_only",
    }


def render_shipping_label_pdf(label_obj) -> tuple[bytes, str]:
    """Genera PDF imprimible de etiqueta logística con código de barras Code128, advertencia QA y SHA-256."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=(105 * mm, 148 * mm),
        leftMargin=6 * mm,
        rightMargin=6 * mm,
        topMargin=6 * mm,
        bottomMargin=6 * mm,
        invariant=1,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("LblTitle", parent=styles["Heading3"], fontSize=10.5, spaceAfter=3)
    warn_style = ParagraphStyle(
        "LblWarn",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=10.5,
        textColor=colors.white,
        backColor=colors.HexColor("#991B1B"),
        borderPadding=4,
    )
    small_style = ParagraphStyle("LblSmall", parent=styles["Normal"], fontSize=8, leading=10)

    shp = label_obj.shipment
    pkg = label_obj.package
    pkg_text = f"Bulto {pkg.package_number} / {pkg.total_packages}" if pkg else "Bulto 1 / 1"
    weight_text = f"{pkg.billable_weight_kg} kg" if pkg else "N/D"
    carrier_name = shp.carrier.name if shp.carrier else "Despacho Interno"
    classification = classify_label_document(label_obj)

    story = [
        Paragraph("LEVELPRO AUDIO — ETIQUETA LOGÍSTICA", title_style),
    ]
    if classification["is_qa_simulation"]:
        story.append(Spacer(1, 1.5 * mm))
        story.append(Paragraph("<b>SIMULACIÓN QA — NO VÁLIDA PARA DESPACHO</b>", warn_style))
        story.append(Spacer(1, 2 * mm))

    story.extend([
        Paragraph(
            f"<b>Tipo:</b> {label_obj.get_label_type_display()} · <b>Clasificación:</b> {classification['document_class']} · <b>NO ES DTE OFICIAL</b>",
            small_style,
        ),
        Spacer(1, 3 * mm),
        Table(
            [
                ["Envío", shp.shipment_number],
                ["Pedido", str(shp.order_id)[:8].upper()],
                ["Transportista", f"{carrier_name} ({classification['carrier_integration_status']})"],
                ["Destino", f"{_mask_address(shp.destination_address)} ({shp.destination_city}, {shp.destination_country})"],
                ["Bulto / Peso", f"{pkg_text} · {weight_text}"],
                ["Tracking", label_obj.tracking_number or shp.tracking_number or shp.shipment_number],
            ],
            colWidths=[28 * mm, 65 * mm],
            style=TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]),
        ),
        Spacer(1, 4 * mm),
        code128.Code128(label_obj.barcode_value, barHeight=14 * mm, barWidth=0.9),
        Spacer(1, 2 * mm),
        Paragraph(f"<font name='Courier' size='8'>{label_obj.barcode_value}</font>", small_style),
    ])
    doc.build(story)
    pdf_bytes = buf.getvalue()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, sha


def render_shipping_manifest_pdf(manifest) -> tuple[bytes, str]:
    """
    LOG10-ACCEPT-02:
    Genera PDF determinista (invariant=1) de manifiesto diario de despacho sin precios,
    costos internos ni PII innecesaria.
    Si el manifiesto está cerrado, renderiza exclusivamente desde manifest.closed_snapshot.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        invariant=1,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ManTitle", parent=styles["Heading2"], fontSize=14, spaceAfter=4)
    warn_style = ParagraphStyle(
        "ManWarn",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        textColor=colors.white,
        backColor=colors.HexColor("#991B1B"),
        borderPadding=5,
    )
    sub_style = ParagraphStyle("ManSub", parent=styles["Normal"], fontSize=9, leading=12)

    snap = manifest.closed_snapshot or {}
    rows = snap.get("items")
    if rows is None:
        rows = []
        for item in manifest.items.select_related("shipment").all():
            shp = item.shipment
            rows.append({
                "shipment_number": shp.shipment_number,
                "order_ref": str(shp.order_id)[:8].upper(),
                "tracking_number": shp.tracking_number or shp.shipment_number,
                "packages_count": shp.packages.count(),
                "destination": f"{shp.destination_city}, {shp.destination_country}",
                "status": shp.status,
            })

    is_qa_sim = (
        manifest.carrier.integration_status != "live"
        or any(str(r.get("tracking_number", "")).startswith(("SIM-", "INT-")) for r in rows)
    )

    table_data = [["Envío", "Pedido", "Guía / Tracking", "Bultos", "Destino", "Estado"]]
    for r in rows:
        table_data.append([
            r["shipment_number"],
            r["order_ref"],
            r["tracking_number"],
            str(r["packages_count"]),
            r["destination"][:34],
            r["status"],
        ])

    story = [
        Paragraph(f"MANIFIESTO DE DESPACHO — {manifest.manifest_number}", title_style),
    ]
    if is_qa_sim:
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("<b>MUESTRA QA — TRANSPORTISTA SIMULADO (NO VÁLIDO PARA RETIRO REAL / NO ES DTE)</b>", warn_style))
        story.append(Spacer(1, 3 * mm))

    story.extend([
        Paragraph(
            f"<b>Fecha operativa:</b> {manifest.operational_date.isoformat()} · "
            f"<b>Bodega:</b> {manifest.warehouse.name} · "
            f"<b>Transportista:</b> {manifest.carrier.name} · "
            f"<b>Estado:</b> {manifest.get_status_display()}",
            sub_style,
        ),
        Paragraph(
            f"<b>Total envíos:</b> {manifest.total_shipments} · "
            f"<b>Total bultos:</b> {manifest.total_packages}",
            sub_style,
        ),
        Spacer(1, 5 * mm),
        Table(
            table_data,
            colWidths=[30 * mm, 22 * mm, 42 * mm, 16 * mm, 46 * mm, 26 * mm],
            repeatRows=1,
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B0E14")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1AFF6E")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]),
        ),
        Spacer(1, 8 * mm),
        Paragraph(
            f"<font name='Courier' size='7.5'>Snapshot SHA-256: {manifest.pdf_sha256 or 'pendiente-cierre'}</font>",
            sub_style,
        ),
        Spacer(1, 6 * mm),
        Paragraph("Firma entrega bodega: _________________________    Firma retiro transportista: _________________________", sub_style),
    ])
    doc.build(story)
    pdf_bytes = buf.getvalue()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, sha
