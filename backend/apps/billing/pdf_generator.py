# apps/billing/pdf_generator.py

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO
from django.utils import timezone


# Colores corporativos
COLOR_DARK   = colors.HexColor("#0a0a0a")
COLOR_ACCENT = colors.HexColor("#1aff6e")
COLOR_GRAY   = colors.HexColor("#6b7280")
COLOR_LIGHT  = colors.HexColor("#f3f4f6")
COLOR_BORDER = colors.HexColor("#e5e7eb")
COLOR_WHITE  = colors.white


def generate_document_pdf(document) -> bytes:
    """
    Genera el PDF de una boleta o factura.
    Retorna bytes del PDF.
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
    )

    config  = document.order.__class__._meta.app_label  # evita import circular
    from apps.billing.models import BillingConfig
    config  = BillingConfig.get()
    order   = document.order
    items   = order.items.all()

    styles  = getSampleStyleSheet()
    story   = []

    # ── Estilo custom ─────────────────────────────────────────
    style_normal = ParagraphStyle(
        "Normal", fontSize=9, leading=14,
        textColor=COLOR_DARK, fontName="Helvetica"
    )
    style_small = ParagraphStyle(
        "Small", fontSize=8, leading=12,
        textColor=COLOR_GRAY, fontName="Helvetica"
    )
    style_bold = ParagraphStyle(
        "Bold", fontSize=9, leading=14,
        textColor=COLOR_DARK, fontName="Helvetica-Bold"
    )
    style_title = ParagraphStyle(
        "Title", fontSize=20, leading=24,
        textColor=COLOR_DARK, fontName="Helvetica-Bold"
    )
    style_header = ParagraphStyle(
        "Header", fontSize=11, leading=16,
        textColor=COLOR_DARK, fontName="Helvetica-Bold"
    )
    style_accent = ParagraphStyle(
        "Accent", fontSize=10, leading=14,
        textColor=colors.HexColor("#059669"), fontName="Helvetica-Bold"
    )

    # ── HEADER ────────────────────────────────────────────────
    tipo_label = {
        "boleta":      "BOLETA DE VENTA",
        "factura":     "FACTURA",
        "nota_credito":"NOTA DE CRÉDITO",
    }.get(document.tipo, document.get_tipo_display().upper())

    header_data = [[
        # Columna izquierda — datos emisor
        [
            Paragraph(config.razon_social or "LevelPro Audio", style_title),
            Spacer(1, 4),
            Paragraph(f"RUT: {config.rut or '—'}", style_small),
            Paragraph(config.giro or "", style_small),
            Paragraph(config.direccion or "", style_small),
            Paragraph(config.ciudad, style_small),
        ],
        # Columna derecha — tipo y número de documento
        [
            Paragraph(tipo_label, ParagraphStyle(
                "TipoDoc", fontSize=13, leading=18,
                textColor=colors.HexColor("#059669"),
                fontName="Helvetica-Bold",
                alignment=TA_RIGHT,
            )),
            Spacer(1, 6),
            Paragraph(f"N° {document.folio}", ParagraphStyle(
                "FolioStyle", fontSize=22, leading=26,
                textColor=COLOR_DARK, fontName="Helvetica-Bold",
                alignment=TA_RIGHT,
            )),
            Spacer(1, 4),
            Paragraph(
                f"Fecha: {document.created_at.strftime('%d/%m/%Y')}",
                ParagraphStyle("DateStyle", fontSize=9, fontName="Helvetica",
                    textColor=COLOR_GRAY, alignment=TA_RIGHT)
            ),
        ]
    ]]

    header_table = Table(header_data, colWidths=[10*cm, 7*cm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN",  (1, 0), (1, 0),  "RIGHT"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.3*cm))
    story.append(HRFlowable(
        width="100%", thickness=2,
        color=colors.HexColor("#059669"), spaceAfter=0.4*cm
    ))

    # ── DATOS RECEPTOR ────────────────────────────────────────
    if document.tipo == "factura" and document.receptor_nombre:
        receptor_data = [
            [Paragraph("DATOS DEL CLIENTE", style_bold), ""],
            [Paragraph("Nombre / Razón Social:", style_small),
             Paragraph(document.receptor_nombre, style_normal)],
            [Paragraph("RUT:", style_small),
             Paragraph(document.receptor_rut or "—", style_normal)],
            [Paragraph("Giro:", style_small),
             Paragraph(document.receptor_giro or "—", style_normal)],
            [Paragraph("Dirección:", style_small),
             Paragraph(document.receptor_direccion or "—", style_normal)],
            [Paragraph("Email:", style_small),
             Paragraph(document.receptor_email or order.email, style_normal)],
        ]
    else:
        receptor_data = [
            [Paragraph("CLIENTE", style_bold), ""],
            [Paragraph("Email:", style_small),
             Paragraph(order.email, style_normal)],
            [Paragraph("Dirección de envío:", style_small),
             Paragraph(order.shipping_address or "—", style_normal)],
        ]

    receptor_table = Table(receptor_data, colWidths=[4*cm, 13*cm])
    receptor_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), COLOR_LIGHT),
        ("SPAN",        (0, 0), (-1, 0)),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",(0, 0), (-1, -1), 6),
        ("GRID",        (0, 0), (-1, -1), 0.5, COLOR_BORDER),
    ]))
    story.append(receptor_table)
    story.append(Spacer(1, 0.4*cm))

    # ── DETALLE DE PRODUCTOS ──────────────────────────────────
    story.append(Paragraph("DETALLE", style_bold))
    story.append(Spacer(1, 0.2*cm))

    items_header = [
        Paragraph("Descripción", style_bold),
        Paragraph("Cant.", ParagraphStyle("C", fontSize=9, fontName="Helvetica-Bold", alignment=TA_CENTER)),
        Paragraph("P. Unitario", ParagraphStyle("C", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
        Paragraph("Total", ParagraphStyle("C", fontSize=9, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
    ]

    items_data = [items_header]
    for item in items:
        subtotal = float(item.price) * item.quantity
        items_data.append([
            Paragraph(item.product_name, style_normal),
            Paragraph(str(item.quantity), ParagraphStyle(
                "Qty", fontSize=9, fontName="Helvetica", alignment=TA_CENTER)),
            Paragraph(f"${float(item.price):,.0f}".replace(",", "."), ParagraphStyle(
                "Price", fontSize=9, fontName="Helvetica", alignment=TA_RIGHT)),
            Paragraph(f"${subtotal:,.0f}".replace(",", "."), ParagraphStyle(
                "Sub", fontSize=9, fontName="Helvetica", alignment=TA_RIGHT)),
        ])

    items_table = Table(
        items_data,
        colWidths=[9*cm, 2*cm, 3.5*cm, 2.5*cm]
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), COLOR_DARK),
        ("TEXTCOLOR",    (0, 0), (-1, 0), COLOR_WHITE),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [COLOR_WHITE, COLOR_LIGHT]),
        ("GRID",         (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("ALIGN",        (1, 0), (-1, -1), "RIGHT"),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 0.4*cm))

    # ── TOTALES ───────────────────────────────────────────────
    neto  = float(document.neto)
    iva   = float(document.iva)
    total = float(document.total)

    totales_data = [
        [Paragraph("Subtotal (neto):", style_small),
         Paragraph(f"${neto:,.0f}".replace(",", "."), ParagraphStyle(
             "TR", fontSize=9, fontName="Helvetica", alignment=TA_RIGHT))],
        [Paragraph(f"IVA ({config.iva_porcentaje}%):", style_small),
         Paragraph(f"${iva:,.0f}".replace(",", "."), ParagraphStyle(
             "TR", fontSize=9, fontName="Helvetica", alignment=TA_RIGHT))],
        [Paragraph("TOTAL:", ParagraphStyle(
             "TotalL", fontSize=11, fontName="Helvetica-Bold")),
         Paragraph(f"${total:,.0f}".replace(",", "."), ParagraphStyle(
             "TotalR", fontSize=11, fontName="Helvetica-Bold",
             alignment=TA_RIGHT, textColor=colors.HexColor("#059669")))],
    ]

    totales_table = Table(totales_data, colWidths=[14*cm, 3*cm])
    totales_table.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE",     (0, 2), (-1, 2), 1.5, COLOR_DARK),
        ("BACKGROUND",    (0, 2), (-1, 2), COLOR_LIGHT),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    story.append(totales_table)
    story.append(Spacer(1, 0.4*cm))

    # ── NOTAS ─────────────────────────────────────────────────
    if document.notas:
        story.append(HRFlowable(width="100%", thickness=0.5,
            color=COLOR_BORDER, spaceAfter=0.2*cm))
        story.append(Paragraph("Notas:", style_bold))
        story.append(Paragraph(document.notas, style_small))
        story.append(Spacer(1, 0.2*cm))

    # ── FOOTER ────────────────────────────────────────────────
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width="100%", thickness=0.5,
        color=COLOR_BORDER, spaceAfter=0.2*cm))

    footer_data = [[
        Paragraph(
            f"Documento emitido por {config.razon_social or 'LevelPro Audio'} · "
            f"{config.email or ''} · {config.telefono or ''}",
            ParagraphStyle("Footer", fontSize=7, textColor=COLOR_GRAY,
                alignment=TA_CENTER)
        )
    ]]
    footer_table = Table(footer_data, colWidths=[17*cm])
    story.append(footer_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes