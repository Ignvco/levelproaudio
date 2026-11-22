"""
Generador de Orden de Compra formal en PDF (BF-03) con ReportLab.
Utiliza configuración empresarial autorizada sin inventar RUT, razón social ni condiciones.
"""

from io import BytesIO
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _get_company_info() -> dict:
    cfg = getattr(settings, "PROCUREMENT_COMPANY_INFO", None) or {}
    return {
        "legal_name": cfg.get("legal_name") or "LevelPro Audio",
        "tax_id": cfg.get("tax_id") or "",
        "address": cfg.get("address") or "",
        "email": cfg.get("email") or "",
        "phone": cfg.get("phone") or "",
    }


def generate_purchase_order_pdf(po, *, include_costs: bool = True) -> bytes:
    """Genera el documento PDF formal de la Orden de Compra."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=f"Orden de Compra {po.po_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "POTitle",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#0B0E14"),
        spaceAfter=4,
    )
    muted_style = ParagraphStyle(
        "POMuted",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=colors.HexColor("#4B5563"),
        leading=12,
    )
    normal_style = ParagraphStyle(
        "PONormal",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#111827"),
        leading=12.5,
    )

    company = _get_company_info()
    elements = []

    # Encabezado
    company_lines = [f"<b>{company['legal_name']}</b>"]
    if company["tax_id"]:
        company_lines.append(f"ID Tributario: {company['tax_id']}")
    if company["address"]:
        company_lines.append(company["address"])
    if company["email"] or company["phone"]:
        company_lines.append(" · ".join(x for x in (company["email"], company["phone"]) if x))

    issue_str = (po.issued_at or po.created_at).strftime("%Y-%m-%d")
    eta_str = po.expected_delivery_date.strftime("%Y-%m-%d") if po.expected_delivery_date else "Por confirmar"

    header_tbl = Table(
        [
            [
                Paragraph("<br/>".join(company_lines), normal_style),
                Paragraph(
                    f"<b>ORDEN DE COMPRA</b><br/>"
                    f"N°: <b>{po.po_number}</b><br/>"
                    f"Estado: {po.get_status_display()}<br/>"
                    f"Emisión: {issue_str}<br/>"
                    f"Entrega est.: {eta_str}",
                    normal_style,
                ),
            ]
        ],
        colWidths=[10.5 * cm, 7.2 * cm],
    )
    header_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#D1D5DB")),
                ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#F3F4F6")),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(Paragraph("LEVELPRO AUDIO — PROCUREMENT", title_style))
    elements.append(Spacer(1, 4))
    elements.append(header_tbl)
    elements.append(Spacer(1, 10))

    # Proveedor & Recepción
    sup = po.supplier
    sup_lines = [
        "<b>PROVEEDOR</b>",
        f"{sup.legal_name}" + (f" ({sup.trade_name})" if sup.trade_name else ""),
        f"Código: {sup.internal_code}" + (f" · ID Tributario: {sup.tax_id}" if sup.tax_id else ""),
        f"País: {sup.country}" + (f" · {sup.address}" if sup.address else ""),
        " · ".join(x for x in (sup.primary_email, sup.primary_phone) if x) or "—",
    ]
    wh_label = f"{po.destination_warehouse.code} — {po.destination_warehouse.name}" if po.destination_warehouse else "Por definir"
    ship_lines = [
        "<b>RECEPCIÓN Y CONDICIONES</b>",
        f"Bodega destino: {wh_label}",
        f"Dirección: {po.delivery_address_snapshot or (po.destination_warehouse.address if po.destination_warehouse and po.destination_warehouse.address else '—')}",
        f"Moneda: {po.currency} · Condición pago: {po.payment_terms_snapshot or '—'}",
        f"Incoterm: {po.incoterm_snapshot or '—'} · Base trib.: {po.tax_basis_snapshot or '—'}",
    ]
    meta_tbl = Table(
        [[Paragraph("<br/>".join(sup_lines), normal_style), Paragraph("<br/>".join(ship_lines), normal_style)]],
        colWidths=[8.85 * cm, 8.85 * cm],
    )
    meta_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                ("PADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    elements.append(meta_tbl)
    elements.append(Spacer(1, 12))

    # Líneas
    rows = [
        [
            Paragraph("<b>SKU Int.</b>", muted_style),
            Paragraph("<b>SKU Prov.</b>", muted_style),
            Paragraph("<b>Descripción</b>", muted_style),
            Paragraph("<b>Cant.</b>", muted_style),
            Paragraph("<b>Costo Unit.</b>", muted_style),
            Paragraph("<b>Subtotal</b>", muted_style),
        ]
    ]
    for item in po.items.all().order_by("created_at"):
        cost_str = f"{item.unit_cost_snapshot:.2f} {item.currency}" if include_costs else "Restringido"
        sub_str = f"{item.line_subtotal:.2f} {item.currency}" if include_costs else "Restringido"
        rows.append(
            [
                Paragraph(item.internal_sku_snapshot or "—", normal_style),
                Paragraph(item.supplier_sku_snapshot or "—", normal_style),
                Paragraph(item.description_snapshot, normal_style),
                Paragraph(str(item.quantity_ordered), normal_style),
                Paragraph(cost_str, normal_style),
                Paragraph(sub_str, normal_style),
            ]
        )

    items_tbl = Table(
        rows,
        colWidths=[2.6 * cm, 2.6 * cm, 6.3 * cm, 1.5 * cm, 2.35 * cm, 2.35 * cm],
        repeatRows=1,
    )
    items_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B0E14")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("ALIGN", (3, 1), (5, -1), "RIGHT"),
            ]
        )
    )
    elements.append(items_tbl)
    elements.append(Spacer(1, 10))

    total_text = f"TOTAL ORDEN ({po.currency}): {po.total_amount:.2f}" if include_costs else f"TOTAL ORDEN ({po.currency}): Restringido"
    elements.append(Paragraph(f"<b>{total_text}</b>", normal_style))

    if po.external_notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"<b>Observaciones:</b> {po.external_notes}", muted_style))

    elements.append(Spacer(1, 14))
    elements.append(
        Paragraph(
            f"Documento generado por LevelPro OS V4.0 · Revisión {po.revision_number} · No constituye DTE tributario.",
            muted_style,
        )
    )

    doc.build(elements)
    return buf.getvalue()
