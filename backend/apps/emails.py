"""Servicio de emails transaccionales (Resend) con plantilla de marca."""
import logging
from django.conf import settings
from django.utils.html import escape

logger = logging.getLogger(__name__)

DEFAULT_ACCENT = "#1aff6e"
BG             = "#0a0a0a"


def _brand():
    """
    Datos reales de Configuración del sitio, con respaldo si todavía no
    se configuró nada — mismo patrón dinámico que usa el resto del sitio.
    """
    try:
        from apps.site_settings.models import SiteSettings
        from core.media import media_url
        site = SiteSettings.get()
        logo_url = media_url(site.logo)
        if logo_url:
            logo_url = f"{settings.FRONTEND_URL.rstrip('/')}{logo_url}" if not logo_url.startswith("http") else logo_url
        return {
            "name":      site.site_name or "LevelPro Audio",
            "accent":    site.accent_color or DEFAULT_ACCENT,
            "logo_url":  logo_url,
            "whatsapp":  site.contact_whatsapp or "",
            "email":     site.contact_email or "",
        }
    except Exception:
        return {"name": "LevelPro Audio", "accent": DEFAULT_ACCENT, "logo_url": None, "whatsapp": "", "email": ""}


def _wrap(title, body_html, cta=None):
    """
    Envuelve el contenido en una plantilla HTML de marca (inline CSS,
    tablas — así se ve bien en Gmail/Outlook/Apple Mail).
    """
    brand  = _brand()
    accent = brand["accent"]
    header_logo = (
        f'<img src="{brand["logo_url"]}" alt="{escape(brand["name"])}" height="28" style="display:block;max-height:28px;width:auto;" />'
        if brand["logo_url"] else
        f'<span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">{escape(brand["name"])}</span>'
    )
    cta_html = ""
    if cta:
        cta_html = f"""
        <tr><td style="padding:8px 32px 32px;">
          <a href="{cta['url']}" style="display:inline-block;background:{accent};color:#000;
            text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">
            {cta['label']}
          </a>
        </td></tr>"""

    contact_bits = []
    if brand["whatsapp"]:
        wa_number = "".join(c for c in brand["whatsapp"] if c.isdigit())
        contact_bits.append(f'<a href="https://wa.me/{wa_number}" style="color:#8a8a8a;text-decoration:none;">WhatsApp</a>')
    if brand["email"]:
        contact_bits.append(f'<a href="mailto:{escape(brand["email"])}" style="color:#8a8a8a;text-decoration:none;">{escape(brand["email"])}</a>')
    contact_line = " · ".join(contact_bits)

    return f"""\
<!doctype html><html><body style="margin:0;background:#050505;font-family:-apple-system,Segoe UI,Roboto,Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;
        background:{BG};border:1px solid #1c1c1c;border-radius:20px;overflow:hidden;">
        <tr><td style="height:3px;background:linear-gradient(90deg,{accent},transparent);"></td></tr>
        <tr><td style="padding:24px 32px 20px;border-bottom:1px solid #1c1c1c;">
          {header_logo}
        </td></tr>
        <tr><td style="padding:32px 32px 12px;">
          <h1 style="margin:0 0 12px;font-size:23px;color:#fff;font-weight:800;letter-spacing:-0.3px;">{escape(title)}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 8px;color:#b8b8b8;font-size:15px;line-height:1.65;">
          {body_html}
        </td></tr>
        {cta_html}
        <tr><td style="padding:24px 32px;border-top:1px solid #1c1c1c;color:#6a6a6a;font-size:12px;line-height:1.8;">
          <strong style="color:#8a8a8a;">{escape(brand["name"])}</strong><br/>
          {contact_line}<br/>
          Este es un email automático, por favor no respondas a esta dirección.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def send_email(to, subject, html, attachments=None):
    """
    Envía un email. Usa Resend si RESEND_API_KEY está configurada; si no,
    cae a Django (consola en desarrollo — EMAIL_BACKEND nunca se sobreescribe
    a un backend real en producción, así que esto NUNCA entrega de verdad).

    attachments: lista opcional de dicts {"filename": str, "content": bytes}.
    Devuelve True/False según si el envío se intentó sin error — la
    mayoría de los llamadores lo ignoran (best-effort, no debe romper el
    flujo principal si un email falla), pero algunos SÍ necesitan saber
    si realmente se mandó antes de marcar algo como "enviado".
    """
    api_key = getattr(settings, "RESEND_API_KEY", "") or ""
    sender  = getattr(settings, "RESEND_FROM_EMAIL", "") or getattr(settings, "DEFAULT_FROM_EMAIL", "onboarding@resend.dev")
    if not to:
        return False
    try:
        if api_key:
            import resend
            import base64
            resend.api_key = api_key
            payload = {"from": sender, "to": [to], "subject": subject, "html": html}
            if attachments:
                payload["attachments"] = [
                    {
                        "filename": a["filename"],
                        "content": base64.b64encode(a["content"]).decode()
                                   if isinstance(a["content"], (bytes, bytearray))
                                   else a["content"],
                    }
                    for a in attachments
                ]
            resend.Emails.send(payload)
        else:
            from django.core.mail import EmailMultiAlternatives
            msg = EmailMultiAlternatives(subject, "Ver este email en HTML.", sender, [to])
            msg.attach_alternative(html, "text/html")
            for a in (attachments or []):
                msg.attach(a["filename"], a["content"], "application/pdf")
            msg.send(fail_silently=True)
        return True
    except Exception as e:
        logger.error(f"[emails] Falló envío a {to}: {e}")
        return False


# ── Emails específicos ────────────────────────────────────────

def send_order_confirmation(order):
    accent = _brand()["accent"]
    ref = str(order.id)[:8].upper()
    rows = ""
    for it in order.items.all():
        rows += f"""<tr>
          <td style="padding:8px 0;color:#e8e8e8;font-size:14px;">{escape(it.product_name)} × {it.quantity}</td>
          <td style="padding:8px 0;color:#e8e8e8;font-size:14px;text-align:right;">${float(it.price)*it.quantity:,.0f}</td>
        </tr>"""
    body = f"""
      <p style="margin:0 0 16px;">¡Gracias por tu compra! Confirmamos el pago de tu orden
        <strong style="color:#fff;">#{ref}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1c1c1c;margin:8px 0;">
        {rows}
        <tr><td style="padding:12px 0 0;border-top:1px solid #1c1c1c;color:#fff;font-weight:700;">Total</td>
        <td style="padding:12px 0 0;border-top:1px solid #1c1c1c;color:{accent};font-weight:800;text-align:right;">
          ${float(order.total):,.0f}</td></tr>
      </table>
      <p style="margin:16px 0 0;">Nos pondremos en contacto para coordinar la entrega.</p>
    """
    html = _wrap(f"Pago confirmado — Orden #{ref}", body)
    send_email(order.email, f"Pago confirmado — Orden #{ref}", html)


def send_ticket_email(email, campaign, codes):
    if not codes:
        return
    accent = _brand()["accent"]
    chips = "".join(
        f'<span style="display:inline-block;background:#111;border:1px solid #2a2a2a;'
        f'color:{accent};font-family:monospace;font-size:14px;font-weight:700;'
        f'padding:8px 14px;border-radius:10px;margin:4px;">{c}</span>'
        for c in codes
    )
    draw = campaign.draw_date.strftime("%d/%m/%Y") if getattr(campaign, "draw_date", None) else ""
    body = f"""
      <p style="margin:0 0 16px;">¡Ya estás participando en <strong style="color:#fff;">{escape(campaign.name)}</strong>!
        Estos son tus {len(codes)} ticket(s):</p>
      <div style="margin:8px 0 16px;">{chips}</div>
      <p style="margin:0;">El sorteo se realiza el <strong style="color:#fff;">{draw}</strong>.
        Podés ver tus tickets en cualquier momento desde tu cuenta.</p>
    """
    html = _wrap("Tus tickets del sorteo", body,
                 cta={"label": "Ver mis participaciones", "url": f"{settings.FRONTEND_URL}/dashboard/rewards"})
    send_email(email, f"Tus tickets para {campaign.name}", html)


def send_password_reset(email, reset_url):
    site_name = _brand()["name"]
    body = f"""
      <p style="margin:0 0 16px;">Recibimos una solicitud para restablecer tu contraseña.</p>
      <p style="margin:0;">Hacé clic en el botón de abajo para crear una nueva. El enlace vence en 1 hora.
        Si no fuiste vos, ignorá este email.</p>
    """
    html = _wrap("Restablecer tu contraseña", body,
                 cta={"label": "Crear nueva contraseña", "url": reset_url})
    send_email(email, f"Restablecer tu contraseña — {site_name}", html)


def send_price_drop_email(user, product):
    accent = _brand()["accent"]
    body = f"""
      <p style="margin:0 0 16px;">Uno de tus favoritos bajó de precio.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1c1c1c;margin:8px 0;padding-top:16px;">
        <tr>
          <td style="padding:8px 0;color:#fff;font-size:15px;font-weight:600;">{escape(product.name)}</td>
          <td style="padding:8px 0;color:{accent};font-size:18px;font-weight:800;text-align:right;">
            ${float(product.price):,.0f}</td>
        </tr>
      </table>
    """
    html = _wrap("¡Bajó de precio!", body,
                 cta={"label": "Ver producto", "url": f"{settings.FRONTEND_URL}/shop/{product.slug}"})
    send_email(user.email, f"{product.name} bajó de precio", html)


def send_back_in_stock_email(user, product):
    body = f"""
      <p style="margin:0 0 16px;">Buenas noticias — uno de tus favoritos volvió a estar disponible.</p>
      <p style="margin:0;color:#fff;font-size:15px;font-weight:600;">{escape(product.name)}</p>
    """
    html = _wrap("¡Volvió a stock!", body,
                 cta={"label": "Comprar ahora", "url": f"{settings.FRONTEND_URL}/shop/{product.slug}"})
    send_email(user.email, f"{product.name} volvió a stock", html)


# ── Servicios: reservas y solicitudes ──────────────────────────
# Antes, agendar un servicio, reservar un turno, y que te lo confirmen
# solo se veía reflejado dentro de la plataforma — nunca se mandaba
# ningún email, a diferencia de las compras de productos (que sí
# tenían su confirmación). Esto cierra ese hueco.

def send_booking_received(booking):
    fecha = booking.scheduled_date.strftime("%d/%m/%Y %H:%M")
    body = f"""
      <p style="margin:0 0 16px;">Recibimos tu reserva para <strong style="color:#fff;">{escape(booking.service.name)}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1c1c1c;margin:8px 0;padding-top:16px;">
        <tr><td style="padding:6px 0;color:#8a8a8a;font-size:13px;">Fecha solicitada</td>
        <td style="padding:6px 0;color:#fff;font-size:14px;font-weight:600;text-align:right;">{fecha}</td></tr>
      </table>
      <p style="margin:16px 0 0;">Te vamos a avisar apenas la confirmemos. Podés ver el estado de tu reserva en
        cualquier momento desde tu cuenta.</p>
    """
    html = _wrap("Recibimos tu reserva", body,
                 cta={"label": "Ver mis reservas", "url": f"{settings.FRONTEND_URL}/dashboard/bookings"})
    send_email(booking.user.email, f"Recibimos tu reserva — {booking.service.name}", html)


def send_booking_confirmed(booking):
    fecha = booking.scheduled_date.strftime("%d/%m/%Y %H:%M")
    body = f"""
      <p style="margin:0 0 16px;">¡Tu reserva quedó <strong style="color:#fff;">confirmada</strong>!</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1c1c1c;margin:8px 0;padding-top:16px;">
        <tr><td style="padding:6px 0;color:#8a8a8a;font-size:13px;">Servicio</td>
        <td style="padding:6px 0;color:#fff;font-size:14px;font-weight:600;text-align:right;">{escape(booking.service.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#8a8a8a;font-size:13px;">Fecha</td>
        <td style="padding:6px 0;color:#fff;font-size:14px;font-weight:600;text-align:right;">{fecha}</td></tr>
      </table>
      <p style="margin:16px 0 0;">Nos vemos pronto. Si necesitás reprogramar o cancelar, hacelo desde tu cuenta.</p>
    """
    html = _wrap("Reserva confirmada", body,
                 cta={"label": "Ver detalle", "url": f"{settings.FRONTEND_URL}/dashboard/bookings"})
    send_email(booking.user.email, f"Reserva confirmada — {booking.service.name}", html)


def send_booking_cancelled(booking):
    fecha = booking.scheduled_date.strftime("%d/%m/%Y %H:%M")
    body = f"""
      <p style="margin:0 0 16px;">Tu reserva para <strong style="color:#fff;">{escape(booking.service.name)}</strong>
        del {fecha} fue cancelada.</p>
      <p style="margin:0;">Si fue un error o querés reagendar, escribinos o volvé a reservar desde el sitio.</p>
    """
    html = _wrap("Reserva cancelada", body,
                 cta={"label": "Reservar de nuevo", "url": f"{settings.FRONTEND_URL}/services"})
    send_email(booking.user.email, f"Reserva cancelada — {booking.service.name}", html)


def send_service_request_received(sr):
    service_name = sr.service.name if sr.service else "tu proyecto"
    body = f"""
      <p style="margin:0 0 16px;">Recibimos tu solicitud sobre <strong style="color:#fff;">{escape(service_name)}</strong>.</p>
      <p style="margin:0;">Te vamos a contactar a la brevedad para coordinar los detalles. Podés ver el estado
        de tu solicitud en cualquier momento desde tu cuenta.</p>
    """
    html = _wrap("Recibimos tu solicitud", body,
                 cta={"label": "Ver mis solicitudes", "url": f"{settings.FRONTEND_URL}/dashboard/services"})
    send_email(sr.email or sr.user.email, f"Recibimos tu solicitud — {service_name}", html)


_REQUEST_STATUS_COPY = {
    "contacted": ("Te contactamos", "Ya nos pusimos en contacto por tu solicitud. Revisá tu WhatsApp o email."),
    "accepted":  ("¡Solicitud aceptada!", "Aceptamos tu solicitud — en breve vas a ver la reserva confirmada en tu cuenta."),
    "rejected":  ("Sobre tu solicitud", "No vamos a poder tomar esta solicitud por ahora. Cualquier duda, escribinos."),
}

def send_service_request_status_update(sr):
    copy = _REQUEST_STATUS_COPY.get(sr.status)
    if not copy:
        return
    title, msg = copy
    service_name = sr.service.name if sr.service else "tu solicitud"
    body = f"""
      <p style="margin:0 0 16px;">Sobre tu solicitud de <strong style="color:#fff;">{escape(service_name)}</strong>:</p>
      <p style="margin:0;">{msg}</p>
    """
    html = _wrap(title, body,
                 cta={"label": "Ver mis solicitudes", "url": f"{settings.FRONTEND_URL}/dashboard/services"})
    send_email(sr.email or sr.user.email, f"{title} — {service_name}", html)
