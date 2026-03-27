# apps/payments/services.py
# Lógica de negocio para cada proveedor de pago
# Separado de las views para mantener las views limpias

import mercadopago
import paypalrestsdk
from django.conf import settings
from .models import Payment, PaymentProvider, PaymentStatus
from apps.orders.models import Order, OrderStatus


# ── MercadoPago ──────────────────────────────────────────────

def get_mp_sdk(provider: str):
    """Retorna el SDK de MercadoPago configurado según el país."""
    if provider == PaymentProvider.MERCADOPAGO_AR:
        token = settings.MP_AR_ACCESS_TOKEN
    else:
        token = settings.MP_CL_ACCESS_TOKEN
    return mercadopago.SDK(token)


def create_mercadopago_preference(order: Order, provider: str) -> dict:
    """
    Crea una preferencia de pago en MercadoPago.
    Retorna { preference_id, init_point (URL de checkout) }
    """
    sdk = get_mp_sdk(provider)

    currency = "ARS" if provider == PaymentProvider.MERCADOPAGO_AR else "CLP"

    items = []
    for item in order.items.all():
        items.append({
            "id":          str(item.product.id) if item.product else "item",
            "title":       item.product_name,
            "quantity":    item.quantity,
            "unit_price":  float(item.price),
            "currency_id": currency,
        })

    preference_data = {
        "items": items,
        "payer": {
            "email": order.email,
        },
        "back_urls": {
            "success": f"{settings.FRONTEND_URL}/payment/success?order={order.id}",
            "failure": f"{settings.FRONTEND_URL}/payment/failure?order={order.id}",
            "pending": f"{settings.FRONTEND_URL}/payment/pending?order={order.id}",
        },
        # auto_return solo funciona con URLs públicas (no localhost)
        # Se activa automáticamente en producción
        "external_reference": str(order.id),
        "notification_url":  f"{settings.BACKEND_URL}/api/v1/payments/webhook/mercadopago/cl/",
        "statement_descriptor": "LEVELPRO AUDIO",
        "expires": False,
    }
    result = sdk.preference().create(preference_data)

    if result["status"] != 201:
        raise ValueError(f"Error MP: {result['response']}")

    preference = result["response"]

    # Guarda el pago en estado pendiente
    Payment.objects.create(
        order=order,
        provider=provider,
        status=PaymentStatus.PENDING,
        amount=order.total,
        currency=currency,
        preference_id=preference["id"],
        payment_url=preference["init_point"],
        raw_response=preference,
    )

    return {
        "preference_id": preference["id"],
        "init_point":    preference["init_point"],
        "sandbox_url":   preference.get("sandbox_init_point", ""),
    }


def process_mercadopago_webhook(data: dict, provider: str) -> None:
    """
    Procesa las notificaciones IPN de MercadoPago.
    Actualiza el estado del pago y de la orden.
    """
    topic = data.get("type") or data.get("topic")

    if topic not in ["payment", "merchant_order"]:
        return

    sdk      = get_mp_sdk(provider)
    mp_id    = data.get("data", {}).get("id") or data.get("id")

    if not mp_id:
        return

    # Consulta el pago en MP
    result = sdk.payment().get(mp_id)
    if result["status"] != 200:
        return

    mp_payment    = result["response"]
    order_id      = mp_payment.get("external_reference")
    mp_status     = mp_payment.get("status")

    if not order_id:
        return

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return

    # Mapeo de estados MP → estados internos
    status_map = {
        "approved":     PaymentStatus.APPROVED,
        "pending":      PaymentStatus.PENDING,
        "in_process":   PaymentStatus.IN_REVIEW,
        "rejected":     PaymentStatus.REJECTED,
        "cancelled":    PaymentStatus.CANCELLED,
        "refunded":     PaymentStatus.REFUNDED,
    }

    internal_status = status_map.get(mp_status, PaymentStatus.PENDING)

    # Actualiza o crea el registro de pago
    payment, _ = Payment.objects.update_or_create(
        external_id=str(mp_id),
        defaults={
            "order":        order,
            "provider":     provider,
            "status":       internal_status,
            "amount":       mp_payment.get("transaction_amount", order.total),
            "raw_response": mp_payment,
        }
    )

    # Si fue aprobado → marca la orden como pagada
    if internal_status == PaymentStatus.APPROVED:
        from django.utils import timezone
        payment.paid_at = timezone.now()
        payment.save(update_fields=["paid_at"])
        order.status = OrderStatus.PAID
        order.save(update_fields=["status"])
        send_payment_confirmation_email(order)


# ── PayPal ───────────────────────────────────────────────────

def configure_paypal():
    """Configura el SDK de PayPal."""
    paypalrestsdk.configure({
        "mode":       settings.PAYPAL_MODE,
        "client_id":  settings.PAYPAL_CLIENT_ID,
        "client_secret": settings.PAYPAL_CLIENT_SECRET,
    })


def create_paypal_order(order: Order) -> dict:
    """
    Crea una orden de pago en PayPal.
    Retorna { order_id, approve_url }
    """
    configure_paypal()

    paypal_payment = paypalrestsdk.Payment({
        "intent": "sale",
        "payer":  {"payment_method": "paypal"},
        "redirect_urls": {
            "return_url": f"{settings.FRONTEND_URL}/payment/success?order={order.id}",
            "cancel_url": f"{settings.FRONTEND_URL}/payment/failure?order={order.id}",
        },
        "transactions": [{
            "item_list": {
                "items": [
                    {
                        "name":     item.product_name,
                        "sku":      str(item.id),
                        "price":    f"{float(item.price):.2f}",
                        "currency": "USD",
                        "quantity": item.quantity,
                    }
                    for item in order.items.all()
                ]
            },
            "amount": {
                "total":    f"{float(order.total):.2f}",
                "currency": "USD",
            },
            "description": f"LevelPro Audio — Orden #{str(order.id)[:8].upper()}",
        }],
    })

    if not paypal_payment.create():
        raise ValueError(f"Error PayPal: {paypal_payment.error}")

    # Guarda el pago pendiente
    approve_url = next(
        (l["href"] for l in paypal_payment.links if l["rel"] == "approval_url"),
        None
    )

    Payment.objects.create(
        order=order,
        provider=PaymentProvider.PAYPAL,
        status=PaymentStatus.PENDING,
        amount=order.total,
        currency="USD",
        preference_id=paypal_payment.id,
        payment_url=approve_url or "",
        raw_response=paypal_payment.to_dict(),
    )

    return {
        "paypal_order_id": paypal_payment.id,
        "approve_url":     approve_url,
    }


def capture_paypal_payment(paypal_payment_id: str, payer_id: str) -> bool:
    """
    Captura el pago de PayPal después de que el usuario aprueba.
    Retorna True si fue exitoso.
    """
    configure_paypal()

    paypal_payment = paypalrestsdk.Payment.find(paypal_payment_id)

    if paypal_payment.execute({"payer_id": payer_id}):
        # Busca el pago interno
        payment = Payment.objects.filter(
            preference_id=paypal_payment_id
        ).first()

        if payment:
            from django.utils import timezone
            payment.status  = PaymentStatus.APPROVED
            payment.paid_at = timezone.now()
            payment.raw_response = paypal_payment.to_dict()
            payment.save()

            payment.order.status = OrderStatus.PAID
            payment.order.save(update_fields=["status"])
            send_payment_confirmation_email(payment.order)

        return True

    return False


# ── Global66 / Transferencia manual ─────────────────────────

def get_global66_info(order: Order) -> dict:
    """
    Retorna los datos de transferencia via Global66.
    No requiere API — es información estática de la cuenta.
    """
    # Crea el registro de pago pendiente
    Payment.objects.get_or_create(
        order=order,
        provider=PaymentProvider.GLOBAL66,
        defaults={
            "status":   PaymentStatus.PENDING,
            "amount":   order.total,
            "currency": "CLP",
        }
    )

    return {
        "alias":        settings.GLOBAL66_ALIAS,
        "account_name": settings.GLOBAL66_ACCOUNT_NAME,
        "bank":         settings.GLOBAL66_BANK,
        "email":        settings.GLOBAL66_EMAIL,
        "amount":       float(order.total),
        "reference":    f"LEVELPRO-{str(order.id)[:8].upper()}",
        "instructions": (
            "Realiza la transferencia por el monto exacto indicando "
            "el número de referencia en el comentario. "
            "Una vez realizada, envíanos el comprobante por WhatsApp "
            "o email y procesaremos tu pedido en menos de 24hs."
        ),
        "whatsapp": "https://wa.me/5492622635045",
    }


# ── Emails ───────────────────────────────────────────────────

def send_payment_confirmation_email(order: Order) -> None:
    """
    Envía email de confirmación de pago.
    Por ahora usa el backend de consola de Django —
    en producción conectaremos SendGrid o similar.
    """
    from django.core.mail import send_mail
    from django.conf import settings as conf

    try:
        send_mail(
            subject=f"✅ Pago confirmado — Orden #{str(order.id)[:8].upper()}",
            message=(
                f"Hola {order.email},\n\n"
                f"Tu pago fue confirmado exitosamente.\n\n"
                f"Orden: #{str(order.id)[:8].upper()}\n"
                f"Total: ${float(order.total):,.0f}\n\n"
                f"Nos pondremos en contacto para coordinar el envío.\n\n"
                f"Equipo LevelPro Audio"
            ),
            from_email=conf.DEFAULT_FROM_EMAIL,
            recipient_list=[order.email],
            fail_silently=True,
        )
    except Exception:
        pass