# apps/payments/services.py

import mercadopago
import paypalrestsdk
from django.conf import settings
from .models import Payment, PaymentProvider, PaymentStatus
from apps.orders.models import Order, OrderStatus


# ── Helpers ──────────────────────────────────────────────────

def get_mp_sdk(provider: str):
    if provider == PaymentProvider.MERCADOPAGO_AR:
        token = settings.MP_AR_ACCESS_TOKEN
    else:
        token = settings.MP_CL_ACCESS_TOKEN
    return mercadopago.SDK(token)


def create_enrollment_if_course(order: Order) -> None:
    """
    Crea enrollment si el producto está vinculado a un curso.
    También intenta por nombre como fallback.
    """
    try:
        from apps.academy.models import Course, Enrollment
        for item in order.items.all():
            course = None

            # Método 1 — producto vinculado directamente al curso
            if item.product and hasattr(item.product, 'course') \
               and item.product.course:
                course = item.product.course

            # Método 2 — busca por nombre como fallback
            if not course:
                course = Course.objects.filter(
                    title__iexact=item.product_name
                ).first()

            if course and order.user:
                Enrollment.objects.get_or_create(
                    user=order.user,
                    course=course,
                )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error creando enrollment: {e}")

# ── MercadoPago ──────────────────────────────────────────────

def create_mercadopago_preference(order: Order, provider: str) -> dict:
    sdk      = get_mp_sdk(provider)
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
        "auto_return":        "approved",
        "external_reference": str(order.id),
        "notification_url": f"{settings.BACKEND_URL}/api/v1/payments/webhook/mercadopago/{'ar' if provider == PaymentProvider.MERCADOPAGO_AR else 'cl'}/",
        "statement_descriptor": "LEVELPRO AUDIO",
        "expires": False,
    }

    result = sdk.preference().create(preference_data)

    if result["status"] != 201:
        raise ValueError(f"Error MP: {result['response']}")

    preference = result["response"]

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
    topic = data.get("type") or data.get("topic")
    if topic not in ["payment", "merchant_order"]:
        return

    sdk   = get_mp_sdk(provider)
    mp_id = data.get("data", {}).get("id") or data.get("id")
    if not mp_id:
        return

    result = sdk.payment().get(mp_id)
    if result["status"] != 200:
        return

    mp_payment = result["response"]
    order_id   = mp_payment.get("external_reference")
    mp_status  = mp_payment.get("status")

    if not order_id:
        return

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return

    status_map = {
        "approved":   PaymentStatus.APPROVED,
        "pending":    PaymentStatus.PENDING,
        "in_process": PaymentStatus.IN_REVIEW,
        "rejected":   PaymentStatus.REJECTED,
        "cancelled":  PaymentStatus.CANCELLED,
        "refunded":   PaymentStatus.REFUNDED,
    }

    internal_status = status_map.get(mp_status, PaymentStatus.PENDING)

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

    if internal_status == PaymentStatus.APPROVED:
        from django.utils import timezone
        payment.paid_at = timezone.now()
        payment.save(update_fields=["paid_at"])
        order.status = OrderStatus.PAID
        order.save(update_fields=["status"])
        send_payment_confirmation_email(order)
        create_enrollment_if_course(order)  # ← enrollment automático


# ── PayPal ───────────────────────────────────────────────────

def configure_paypal():
    paypalrestsdk.configure({
        "mode":          settings.PAYPAL_MODE,
        "client_id":     settings.PAYPAL_CLIENT_ID,
        "client_secret": settings.PAYPAL_CLIENT_SECRET,
    })


def create_paypal_order(order: Order) -> dict:
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
    configure_paypal()
    paypal_payment = paypalrestsdk.Payment.find(paypal_payment_id)

    if paypal_payment.execute({"payer_id": payer_id}):
        payment = Payment.objects.filter(
            preference_id=paypal_payment_id
        ).first()

        if payment:
            from django.utils import timezone
            payment.status      = PaymentStatus.APPROVED
            payment.paid_at     = timezone.now()
            payment.raw_response = paypal_payment.to_dict()
            payment.save()

            payment.order.status = OrderStatus.PAID
            payment.order.save(update_fields=["status"])
            send_payment_confirmation_email(payment.order)
            create_enrollment_if_course(payment.order)  # ← enrollment automático

        return True

    return False


# ── Global66 ─────────────────────────────────────────────────

def get_global66_info(order: Order) -> dict:
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


# ── Emails ────────────────────────────────────────────────────

def send_payment_confirmation_email(order: Order) -> None:
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