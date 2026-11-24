# apps/orders/logistics_pdf.py
"""
LEVELPRO OS V4.0 — GATE 10: REPORTLAB PDF GENERATORS (BF-25)
- Etiquetas logísticas imprimibles (con código de barras Code128 y distinción explícita: NO es DTE).
- Manifiestos de despacho diarios (sin precios ni costos internos, reproducibles desde snapshot).
"""

import hashlib
import io

from reportlab.graphics.barcode import code128
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def _mask_address(addr: str) -> str:
    clean = (addr or "").strip()
    return clean[:80] if clean else "Destino reservado"


def render_shipping_label_pdf(label_obj) -> tuple[bytes, str]:
    """Genera PDF imprimible de etiqueta logística con código de barras Code128 y SHA-256."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=(105 * mm, 148 * mm),
        leftMargin=6 * mm,
        rightMargin=6 * mm,
        topMargin=6 * mm,
        bottomMargin=6 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("LblTitle", parent=styles["Heading3"], fontSize=11, spaceAfter=4)
    small_style = ParagraphStyle("LblSmall", parent=styles["Normal"], fontSize=8, leading=10)

    shp = label_obj.shipment
    pkg = label_obj.package
    pkg_text = f"Bulto {pkg.package_number} / {pkg.total_packages}" if pkg else "Bulto 1 / 1"
    weight_text = f"{pkg.billable_weight_kg} kg" if pkg else "N/D"
    carrier_name = shp.carrier.name if shp.carrier else "Despacho Interno"

    story = [
        Paragraph("LEVELPRO AUDIO — ETIQUETA LOGÍSTICA", title_style),
        Paragraph(
            f"<b>Tipo:</b> {label_obj.get_label_type_display()} · <b>NO ES DTE OFICIAL</b>",
            small_style,
        ),
        Spacer(1, 3 * mm),
        Table(
            [
                ["Envío", shp.shipment_number],
                ["Pedido", str(shp.order_id)[:8].upper()],
                ["Transportista", carrier_name],
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
        Spacer(1, 5 * mm),
        code128.Code128(label_obj.barcode_value, barHeight=14 * mm, barWidth=0.9),
        Spacer(1, 2 * mm),
        Paragraph(f"<font name='Courier' size='8'>{label_obj.barcode_value}</font>", small_style),
    ]
    doc.build(story)
    pdf_bytes = buf.getvalue()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, sha


def render_shipping_manifest_pdf(manifest) -> tuple[bytes, str]:
    """
    Genera PDF de manifiesto diario de despacho sin exponer precios ni costos internos.
    Si el manifiesto está cerrado, renderiza deterministamente desde manifest.closed_snapshot.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ManTitle", parent=styles["Heading2"], fontSize=14, spaceAfter=4)
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
        Spacer(1, 10 * mm),
        Paragraph("Firma entrega bodega: _________________________    Firma retiro transportista: _________________________", sub_style),
    ]
    doc.build(story)
    pdf_bytes = buf.getvalue()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, sha
