# apps/payments/services.py

import mercadopago
import paypalrestsdk
from django.conf import settings
from .models import Payment, PaymentProvider, PaymentStatus
from .webhooks import verify_mp_webhook_signature  # compatibilidad con imports existentes
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

            # Método 2 — busca por nombre como fallback (el product_name
            # real que usa el checkout de cursos siempre tiene el prefijo
            # "Curso: " — antes no se sacaba, así que este fallback nunca
            # encontraba nada)
            if not course:
                name = item.product_name.replace("Curso: ", "").strip()
                course = Course.objects.filter(title__iexact=name).first()

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
        "external_reference": str(order.id),
        "notification_url": f"{settings.BACKEND_URL}/api/v1/payments/webhook/mercadopago/{'ar' if provider == PaymentProvider.MERCADOPAGO_AR else 'cl'}/",
        "statement_descriptor": "LEVELPRO AUDIO",
        "expires": False,
        "binary_mode": False,
    }
    
    if "localhost" not in settings.FRONTEND_URL:
        preference_data["auto_return"] = "approved"



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
        "init_point":    preference["init_point"],  # link de checkout REAL (producción)
    }


def process_mercadopago_webhook(data: dict, provider: str) -> None:
    # Las vistas entregan el ID firmado y un payload normalizado. Se mantienen
    # los alias topic/id para llamadas internas existentes.
    topic = data.get("type") or data.get("topic")
    # Una merchant_order tiene otro endpoint e ID; no es un payment.
    if topic != "payment":
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

    # Si MP dice "aprobado" pero el monto realmente cobrado no coincide
    # con el total de la orden, NO lo aprobamos automáticamente — misma
    # clase de riesgo que ya tapamos en la creación de órdenes (nunca
    # confiar en un monto sin validarlo contra lo que el sistema espera).
    # Un mismatch legítimo puede pasar por redondeo de moneda o un
    # descuento aplicado del lado de MP que no se reflejó acá — en esos
    # casos preferimos que un humano lo revise antes de dar el pedido
    # por pagado, en vez de aprobar en automático algo que no cuadra.
    mp_amount = mp_payment.get("transaction_amount")
    amount_mismatch = False
    if internal_status == PaymentStatus.APPROVED and mp_amount is not None:
        expected = float(order.total)
        tolerance = max(expected * 0.01, 1.0)  # 1% o $1, lo que sea mayor
        if abs(float(mp_amount) - expected) > tolerance:
            amount_mismatch = True
            internal_status = PaymentStatus.IN_REVIEW
            import logging
            logging.getLogger(__name__).error(
                f"MP webhook: monto no coincide para orden {order.id} — "
                f"esperado ${expected}, MP reporta ${mp_amount}. "
                f"Pago queda en revisión, NO se marca la orden como pagada."
            )

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

    if internal_status == PaymentStatus.APPROVED and not amount_mismatch:
        from django.utils import timezone
        payment.paid_at = timezone.now()
        payment.save(update_fields=["paid_at"])
        order.status = OrderStatus.PAID
        order.save(update_fields=["status"])
        # ↑ este save() ya dispara el signal enroll_user_in_course de
        # academy/signals.py — no hace falta (ni conviene) repetir esa
        # lógica acá para cada proveedor de pago por separado.
        send_payment_confirmation_email(order)


# ── PayPal ───────────────────────────────────────────────────

def configure_paypal():
    paypalrestsdk.configure({
        "mode":          settings.PAYPAL_MODE,
        "client_id":     settings.PAYPAL_CLIENT_ID,
        "client_secret": settings.PAYPAL_CLIENT_SECRET,
    })


def create_paypal_order(order: Order) -> dict:
    configure_paypal()

    # PayPal no soporta CLP → convertimos el total a USD con una tasa configurable.
    from decimal import Decimal, ROUND_HALF_UP
    currency = (getattr(order, "currency", "CLP") or "CLP").upper()
    if currency == "USD":
        total_usd = Decimal(str(order.total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif currency == "CLP":
        rate = Decimal(str(settings.USD_CLP_RATE))
        if rate <= 0:
            raise ValueError("USD_CLP_RATE debe ser mayor que cero")
        total_usd = (Decimal(str(order.total)) / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        raise ValueError("Moneda no admitida para PayPal")
    if total_usd < Decimal("1.00"):
        total_usd = Decimal("1.00")  # PayPal exige mínimo

    paypal_payment = paypalrestsdk.Payment({
        "intent": "sale",
        "payer":  {"payment_method": "paypal"},
        "redirect_urls": {
            "return_url": f"{settings.FRONTEND_URL}/payment/success?order={order.id}",
            "cancel_url": f"{settings.FRONTEND_URL}/payment/failure?order={order.id}",
        },
        "transactions": [{
            "amount": {
                "total":    f"{total_usd:.2f}",
                "currency": "USD",
            },
            "description": f"LevelPro Audio — Orden #{str(order.id)[:8].upper()} "
                           f"({order.total} {currency})",
        }],
    })

    if not paypal_payment.create():
        raise ValueError(f"Error PayPal: {paypal_payment.error}")

    approve_url = next(
        (link["href"] for link in paypal_payment.links if link["rel"] == "approval_url"),
        None
    )

    Payment.objects.create(
        order=order,
        provider=PaymentProvider.PAYPAL,
        status=PaymentStatus.PENDING,
        amount=total_usd,
        currency="USD",
        preference_id=paypal_payment.id,
        payment_url=approve_url or "",
        raw_response=paypal_payment.to_dict(),
    )

    return {
        "paypal_order_id": paypal_payment.id,
        "approve_url":     approve_url,
    }


def capture_paypal_payment(paypal_payment_id: str, payer_id: str, user) -> bool:
    # Rechazar antes de contactar a PayPal: el ID proviene del cliente.
    payment = Payment.objects.filter(
        preference_id=paypal_payment_id,
        provider=PaymentProvider.PAYPAL,
        order__user=user,
        status=PaymentStatus.PENDING,
        order__status=OrderStatus.PENDING,
    ).first()
    if payment is None:
        return False

    configure_paypal()
    paypal_payment = paypalrestsdk.Payment.find(paypal_payment_id)

    if paypal_payment.execute({"payer_id": payer_id}):
        if payment:
            # Mismo criterio que en MercadoPago: verificar que lo
            # realmente capturado coincida con lo que se creó acá antes
            # de dar el pago por aprobado.
            captured_amount = None
            try:
                captured_amount = float(paypal_payment.transactions[0].amount.total)
            except (AttributeError, IndexError, ValueError, TypeError):
                pass

            expected = float(payment.amount)
            tolerance = max(expected * 0.01, 0.01)
            amount_mismatch = (
                captured_amount is not None
                and abs(captured_amount - expected) > tolerance
            )

            from django.utils import timezone
            payment.raw_response = paypal_payment.to_dict()

            if amount_mismatch:
                payment.status = PaymentStatus.IN_REVIEW
                payment.save()
                import logging
                logging.getLogger(__name__).error(
                    f"PayPal capture: monto no coincide para orden {payment.order_id} — "
                    f"esperado ${expected}, PayPal capturó ${captured_amount}. "
                    f"Pago queda en revisión, NO se marca la orden como pagada."
                )
                return False

            payment.status  = PaymentStatus.APPROVED
            payment.paid_at = timezone.now()
            payment.save()

            payment.order.status = OrderStatus.PAID
            payment.order.save(update_fields=["status"])
            send_payment_confirmation_email(payment.order)
            # El signal enroll_user_in_course ya se disparó con el save() de arriba.

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

    from apps.site_settings.models import SiteSettings
    site = SiteSettings.get()
    whatsapp_number = "".join(c for c in (site.contact_whatsapp or "+5492622635045") if c.isdigit())

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
        "whatsapp": f"https://wa.me/{whatsapp_number}",
    }


# ── Emails ────────────────────────────────────────────────────

def send_payment_confirmation_email(order: Order) -> None:
    from apps.emails import send_order_confirmation
    send_order_confirmation(order)