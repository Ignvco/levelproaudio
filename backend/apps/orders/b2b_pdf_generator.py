# apps/orders/b2b_pdf_generator.py
"""
LEVELPRO OS V4.0 — GATE 8 (BF-20): GENERADOR PDF DE COTIZACIONES B2B CON REPORTLAB
- Reutiliza el patrón de Gate 5 (po_pdf_generator.py) sin inventar RUT ni datos legales.
- Soporta dos diseños funcionales documentados para revisión del propietario:
  1. classic_corporate: Diseño A — Corporativo Clásico.
  2. modern_technical: Diseño B — Técnico Pro Audio.
- Persiste snapshots versionados con checksum SHA-256 en B2BQuotePDFSnapshot.
"""

import hashlib
from io import BytesIO

from django.conf import settings
from django.db import transaction
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.orders.crm_models import B2BQuotePDFSnapshot
from apps.orders.models import B2BQuote
from apps.site_settings.models import SiteSettings


def _get_issuer_company_info() -> dict:
    """Obtiene datos configurados de la empresa emisora sin inventar RUT o dirección fiscal."""
    cfg = getattr(settings, "PROCUREMENT_COMPANY_INFO", None) or {}
    site = SiteSettings.objects.first()
    return {
        "legal_name": cfg.get("legal_name") or (site.site_name if site else "LevelPro Audio"),
        "tax_id": cfg.get("tax_id") or "",
        "address": cfg.get("address") or "",
        "email": cfg.get("email") or (site.contact_email if site else ""),
        "phone": cfg.get("phone") or (site.contact_whatsapp if site else ""),
    }


def _fmt_amt(val, currency: str) -> str:
    curr = (currency or "CLP").upper()
    if curr == "CLP":
        try:
            return f"CLP ${int(round(float(val))):,}".replace(",", ".")
        except Exception:
            return f"CLP {val}"
    return f"{curr} {val}"


def render_b2b_quote_pdf_bytes(
    quote: B2BQuote,
    *,
    design_variant: str = B2BQuotePDFSnapshot.DesignVariant.CLASSIC_CORPORATE,
) -> bytes:
    """Renderiza los bytes del PDF de cotización B2B con ReportLab."""
    is_modern = design_variant == B2BQuotePDFSnapshot.DesignVariant.MODERN_TECHNICAL
    buf = BytesIO()
    q_code = quote.quote_number or f"QTE-{str(quote.id)[:8].upper()}"

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
        title=f"Cotizacion B2B {q_code} v{quote.version}",
    )

    styles = getSampleStyleSheet()
    accent_hex = "#1AFF6E" if is_modern else "#0F172A"
    dark_hex = "#0B0E14"

    title_style = ParagraphStyle(
        "QTitle",
        parent=styles["Heading1"],
        fontSize=15,
        textColor=colors.HexColor("#FFFFFF" if is_modern else dark_hex),
        spaceAfter=2,
    )
    muted_style = ParagraphStyle(
        "QMuted",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=colors.HexColor("#4B5563"),
        leading=11.5,
    )
    normal_style = ParagraphStyle(
        "QNormal",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#111827"),
        leading=12,
    )
    header_light = ParagraphStyle(
        "QHeaderLight",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=colors.HexColor("#E5E7EB"),
        leading=11.5,
    )

    issuer = _get_issuer_company_info()
    elements = []

    issue_str = (quote.issued_at or quote.created_at).strftime("%Y-%m-%d")
    valid_str = quote.valid_until.strftime("%Y-%m-%d") if quote.valid_until else "Por confirmar"

    issuer_lines = [f"<b>{issuer['legal_name']}</b>"]
    if issuer["tax_id"]:
        issuer_lines.append(f"ID Tributario: {issuer['tax_id']}")
    if issuer["address"]:
        issuer_lines.append(issuer["address"])
    if issuer["email"] or issuer["phone"]:
        issuer_lines.append(" · ".join(x for x in (issuer["email"], issuer["phone"]) if x))

    if is_modern:
        banner = Table(
            [
                [
                    Paragraph("<br/>".join(issuer_lines), header_light),
                    Paragraph(
                        f"<b>COTIZACIÓN B2B</b><br/>N° {q_code} · Versión {quote.version}<br/>"
                        f"Emisión: {issue_str} · Vigencia: {valid_str}",
                        title_style,
                    ),
                ]
            ],
            colWidths=[9.5 * cm, 8.5 * cm],
        )
        banner.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(dark_hex)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW", (0, 0), (-1, -1), 2.5, colors.HexColor(accent_hex)),
            ])
        )
        elements.append(banner)
    else:
        header_tbl = Table(
            [
                [
                    Paragraph("<br/>".join(issuer_lines), normal_style),
                    Paragraph(
                        f"<b>COTIZACIÓN COMERCIAL B2B</b><br/>"
                        f"Folio: <b>{q_code}</b> (v{quote.version})<br/>"
                        f"Emisión: {issue_str}<br/>"
                        f"Vigencia hasta: {valid_str}",
                        normal_style,
                    ),
                ]
            ],
            colWidths=[10.0 * cm, 8.0 * cm],
        )
        header_tbl.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.HexColor("#0F172A")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        elements.append(header_tbl)

    elements.append(Spacer(1, 0.4 * cm))

    # Datos del cliente y condiciones comerciales
    sales_rep_str = quote.sales_rep.email if quote.sales_rep_id and quote.sales_rep else "Equipo Comercial B2B"
    client_block = (
        f"<b>Cliente / Organización:</b> {quote.company_name}<br/>"
        f"<b>ID Tributario:</b> {quote.tax_id}<br/>"
        f"<b>Contacto:</b> {quote.contact_name} ({quote.email})<br/>"
        f"<b>Teléfono:</b> {quote.phone or '—'}"
    )
    terms_block = (
        f"<b>Moneda:</b> {quote.currency}<br/>"
        f"<b>Condición de Pago:</b> {quote.payment_terms or 'prepaid'}<br/>"
        f"<b>Entrega / Despacho:</b> {quote.delivery_terms or 'Por coordinar'}<br/>"
        f"<b>Ejecutivo:</b> {sales_rep_str}"
    )

    info_tbl = Table(
        [[Paragraph(client_block, normal_style), Paragraph(terms_block, normal_style)]],
        colWidths=[9.5 * cm, 8.5 * cm],
    )
    info_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(info_tbl)
    elements.append(Spacer(1, 0.4 * cm))

    # Tabla de ítems
    rows = [["SKU", "Producto / Variante", "Cant.", "Precio Unit.", "Desc.", "Subtotal"]]
    for item in quote.items.select_related("product", "variant").all():
        sku = item.sku_snapshot or (item.variant.sku if item.variant else (item.product.sku if item.product else "—"))
        desc = item.product_name
        if item.variant_name_snapshot:
            desc = f"{desc} ({item.variant_name_snapshot})"
        rows.append([
            sku[:18],
            Paragraph(desc, normal_style),
            str(item.quantity),
            _fmt_amt(item.unit_price, quote.currency),
            f"{item.discount_percent}%",
            _fmt_amt(item.subtotal, quote.currency),
        ])

    items_tbl = Table(rows, colWidths=[2.6 * cm, 6.8 * cm, 1.4 * cm, 2.7 * cm, 1.6 * cm, 2.9 * cm])
    items_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(dark_hex if is_modern else "#1E293B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
            ("ALIGN", (2, 1), (5, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    elements.append(items_tbl)
    elements.append(Spacer(1, 0.35 * cm))

    # Totales
    totals_rows = [
        ["Subtotal Neto:", _fmt_amt(quote.subtotal, quote.currency)],
        [f"Descuento ({quote.discount_percent}%):", f"-{_fmt_amt(quote.discount_amount, quote.currency)}"],
        [f"Impuestos ({quote.tax_regime or 'Según configuración'}):", _fmt_amt(quote.tax_amount, quote.currency)],
        ["TOTAL COTIZADO:", _fmt_amt(quote.total, quote.currency)],
    ]
    totals_tbl = Table(totals_rows, colWidths=[13.5 * cm, 4.5 * cm])
    totals_tbl.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
            ("LINEABOVE", (0, 3), (-1, 3), 1.0, colors.HexColor("#0F172A")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    elements.append(totals_tbl)

    if quote.client_notes:
        elements.append(Spacer(1, 0.35 * cm))
        elements.append(Paragraph(f"<b>Observaciones:</b> {quote.client_notes}", muted_style))

    elements.append(Spacer(1, 0.5 * cm))
    elements.append(
        Paragraph(
            "<i>Documento comercial referencial emitido por LevelPro Audio. No constituye DTE, boleta ni factura electrónica SII/AFIP. "
            "Sujeto a disponibilidad de inventario y vigencia comercial indicada.</i>",
            muted_style,
        )
    )

    doc.build(elements)
    return buf.getvalue()


@transaction.atomic
def generate_and_store_b2b_quote_pdf(
    quote: B2BQuote,
    *,
    design_variant: str = B2BQuotePDFSnapshot.DesignVariant.CLASSIC_CORPORATE,
    actor=None,
) -> B2BQuotePDFSnapshot:
    """Genera el PDF con ReportLab, calcula SHA-256 y conserva el snapshot versionado."""
    if design_variant not in B2BQuotePDFSnapshot.DesignVariant.values:
        design_variant = B2BQuotePDFSnapshot.DesignVariant.CLASSIC_CORPORATE

    existing = B2BQuotePDFSnapshot.objects.filter(
        quote=quote,
        version=quote.version,
        design_variant=design_variant,
    ).first()
    if existing is not None:
        return existing

    pdf_bytes = render_b2b_quote_pdf_bytes(quote, design_variant=design_variant)
    checksum = hashlib.sha256(pdf_bytes).hexdigest()

    return B2BQuotePDFSnapshot.objects.create(
        quote=quote,
        version=quote.version,
        design_variant=design_variant,
        sha256_checksum=checksum,
        file_size_bytes=len(pdf_bytes),
        pdf_bytes=pdf_bytes,
        generated_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
