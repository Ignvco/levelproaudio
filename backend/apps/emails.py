"""Servicio de emails transaccionales (Resend) con plantilla de marca LevelPro."""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

ACCENT = "#1aff6e"
BG     = "#0a0a0a"


def _wrap(title, body_html, cta=None):
    """Envuelve el contenido en una plantilla HTML de marca (inline CSS)."""
    cta_html = ""
    if cta:
        cta_html = f"""
        <tr><td style="padding:8px 32px 32px;">
          <a href="{cta['url']}" style="display:inline-block;background:{ACCENT};color:#000;
            text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">
            {cta['label']}
          </a>
        </td></tr>"""
    return f"""\
<!doctype html><html><body style="margin:0;background:#050505;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;
        background:{BG};border:1px solid #1c1c1c;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;border-bottom:1px solid #1c1c1c;">
          <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
            level<span style="color:{ACCENT};">pro</span> audio
          </span>
        </td></tr>
        <tr><td style="padding:32px 32px 12px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#fff;font-weight:800;">{title}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 8px;color:#b8b8b8;font-size:15px;line-height:1.65;">
          {body_html}
        </td></tr>
        {cta_html}
        <tr><td style="padding:24px 32px;border-top:1px solid #1c1c1c;color:#6a6a6a;font-size:12px;">
          LevelPro Audio · Audio Profesional · Chile &amp; Argentina<br/>
          Este es un email automático, por favor no respondas a esta dirección.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def send_email(to, subject, html):
    """Envía un email. Usa Resend si RESEND_API_KEY está configurada; si no, cae a Django (consola)."""
    api_key = getattr(settings, "RESEND_API_KEY", "") or ""
    sender  = getattr(settings, "RESEND_FROM_EMAIL", "") or getattr(settings, "DEFAULT_FROM_EMAIL", "onboarding@resend.dev")
    if not to:
        return
    try:
        if api_key:
            import resend
            resend.api_key = api_key
            resend.Emails.send({"from": sender, "to": [to], "subject": subject, "html": html})
        else:
            from django.core.mail import EmailMultiAlternatives
            msg = EmailMultiAlternatives(subject, "Ver este email en HTML.", sender, [to])
            msg.attach_alternative(html, "text/html")
            msg.send(fail_silently=True)
    except Exception as e:
        logger.error(f"[emails] Falló envío a {to}: {e}")


# ── Emails específicos ────────────────────────────────────────

def send_order_confirmation(order):
    ref = str(order.id)[:8].upper()
    rows = ""
    for it in order.items.all():
        rows += f"""<tr>
          <td style="padding:8px 0;color:#e8e8e8;font-size:14px;">{it.product_name} × {it.quantity}</td>
          <td style="padding:8px 0;color:#e8e8e8;font-size:14px;text-align:right;">${float(it.price)*it.quantity:,.0f}</td>
        </tr>"""
    body = f"""
      <p style="margin:0 0 16px;">¡Gracias por tu compra! Confirmamos el pago de tu orden
        <strong style="color:#fff;">#{ref}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1c1c1c;margin:8px 0;">
        {rows}
        <tr><td style="padding:12px 0 0;border-top:1px solid #1c1c1c;color:#fff;font-weight:700;">Total</td>
        <td style="padding:12px 0 0;border-top:1px solid #1c1c1c;color:{ACCENT};font-weight:800;text-align:right;">
          ${float(order.total):,.0f}</td></tr>
      </table>
      <p style="margin:16px 0 0;">Nos pondremos en contacto para coordinar la entrega.</p>
    """
    html = _wrap(f"Pago confirmado — Orden #{ref}", body)
    send_email(order.email, f"✅ Pago confirmado — Orden #{ref}", html)


def send_ticket_email(email, campaign, codes):
    if not codes:
        return
    chips = "".join(
        f'<span style="display:inline-block;background:#111;border:1px solid #2a2a2a;'
        f'color:{ACCENT};font-family:monospace;font-size:14px;font-weight:700;'
        f'padding:8px 14px;border-radius:10px;margin:4px;">{c}</span>'
        for c in codes
    )
    draw = campaign.draw_date.strftime("%d/%m/%Y") if getattr(campaign, "draw_date", None) else ""
    body = f"""
      <p style="margin:0 0 16px;">¡Ya estás participando en <strong style="color:#fff;">{campaign.name}</strong>!
        Estos son tus {len(codes)} ticket(s):</p>
      <div style="margin:8px 0 16px;">{chips}</div>
      <p style="margin:0;">El sorteo se realiza el <strong style="color:#fff;">{draw}</strong>.
        Podés ver tus tickets en cualquier momento desde tu cuenta.</p>
    """
    html = _wrap("🎟️ Tus tickets del sorteo", body,
                 cta={"label": "Ver mis participaciones", "url": f"{settings.FRONTEND_URL}/dashboard/rewards"})
    send_email(email, f"🎟️ Tus tickets para {campaign.name}", html)


def send_password_reset(email, reset_url):
    body = f"""
      <p style="margin:0 0 16px;">Recibimos una solicitud para restablecer tu contraseña.</p>
      <p style="margin:0;">Hacé clic en el botón de abajo para crear una nueva. El enlace vence en 1 hora.
        Si no fuiste vos, ignorá este email.</p>
    """
    html = _wrap("Restablecer tu contraseña", body,
                 cta={"label": "Crear nueva contraseña", "url": reset_url})
    send_email(email, "Restablecer tu contraseña — LevelPro Audio", html)
