# apps/academy/certificate_generator.py
#
# Certificado simple de finalización de curso: nombre del alumno, curso,
# fecha. Mismo lenguaje visual (colores de marca) que billing/pdf_generator.py
# para que todo lo que emite la plataforma se vea consistente.

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from io import BytesIO

COLOR_DARK   = colors.HexColor("#0a0a0a")
COLOR_ACCENT = colors.HexColor("#1aff6e")
COLOR_GRAY   = colors.HexColor("#6b7280")
COLOR_WHITE  = colors.white


def generate_certificate_pdf(enrollment) -> bytes:
    """
    Genera el PDF del certificado de finalización para un Enrollment
    con completed_at seteado. Retorna bytes del PDF.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=3*cm, leftMargin=3*cm,
        topMargin=3*cm, bottomMargin=3*cm,
    )

    user   = enrollment.user
    course = enrollment.course
    nombre = f"{user.first_name} {user.last_name}".strip() or user.email
    fecha  = enrollment.completed_at.strftime("%d de %B de %Y") if enrollment.completed_at else ""

    style_eyebrow = ParagraphStyle(
        "Eyebrow", fontSize=11, leading=14, textColor=COLOR_ACCENT,
        fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=18,
    )
    style_title = ParagraphStyle(
        "Title", fontSize=15, leading=20, textColor=COLOR_GRAY,
        fontName="Helvetica", alignment=TA_CENTER, spaceAfter=6,
    )
    style_name = ParagraphStyle(
        "Name", fontSize=32, leading=38, textColor=COLOR_DARK,
        fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=14,
    )
    style_course = ParagraphStyle(
        "Course", fontSize=20, leading=26, textColor=COLOR_DARK,
        fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=20,
    )
    style_date = ParagraphStyle(
        "Date", fontSize=11, leading=14, textColor=COLOR_GRAY,
        fontName="Helvetica", alignment=TA_CENTER,
    )

    story = [
        Spacer(1, 0.8*cm),
        Paragraph("LEVELPRO AUDIO · ACADEMIA", style_eyebrow),
        Spacer(1, 0.6*cm),
        Paragraph("Certificado de finalización", style_title),
        Spacer(1, 0.4*cm),
        Paragraph("Se otorga el presente certificado a", style_date),
        Spacer(1, 0.5*cm),
        Paragraph(nombre, style_name),
        HRFlowable(width="30%", thickness=1, color=COLOR_ACCENT, spaceBefore=6, spaceAfter=20, hAlign="CENTER"),
        Paragraph("por completar satisfactoriamente el curso", style_date),
        Spacer(1, 0.3*cm),
        Paragraph(course.title, style_course),
        Spacer(1, 0.6*cm),
        Paragraph(f"Emitido el {fecha}", style_date),
    ]

    doc.build(story)
    return buffer.getvalue()
