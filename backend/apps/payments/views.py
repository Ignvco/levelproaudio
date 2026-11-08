# apps/payments/views.py

import logging
from uuid import uuid4
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt

from apps.orders.models import Order
from .models import Payment, PaymentProvider, PaymentStatus, PaymentWebhookEvent, WebhookEventStatus
from .serializers import CreatePaymentRequestSerializer, CapturePayPalRequestSerializer
from .transfer_instructions import bank_accounts_for, instructions_for
from .payment_availability import method_can_checkout, method_has_payment_instructions
from .webhooks import get_mp_webhook_secret, normalize_mp_webhook
from .services import (
    create_mercadopago_preference,
    process_mercadopago_webhook,
    verify_mp_webhook_signature,
    create_paypal_order,
    capture_paypal_payment,
    get_global66_info,
)

logger = logging.getLogger(__name__)


def _payment_error_response(message, *, operation, provider, order_id=None):
    """Keep exception details server-side and return an opaque support reference."""
    error_id = uuid4().hex
    logger.exception(
        "Error de pago error_id=%s operation=%s provider=%s order_id=%s",
        error_id, operation, provider, order_id,
    )
    return Response(
        {"error": message, "error_id": error_id},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_payment(request):
    """
    POST /api/v1/payments/create/
    Body: { order_id, provider }

    Crea la intención de pago según el proveedor elegido.
    """
    serializer = CreatePaymentRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Datos de pago inválidos. Revisa la orden y el proveedor."},
            status=status.HTTP_400_BAD_REQUEST
        )
    order_id = serializer.validated_data["order_id"]
    provider = serializer.validated_data["provider"]

    try:
        try:
            order = Order.objects.get(id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response(
                {"error": "Orden no encontrada."},
                status=status.HTTP_404_NOT_FOUND
            )

        if order.status != "pending":
            return Response(
                {"error": "Esta orden ya fue procesada."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # The client's selection is advisory. Recheck against the actual order
        # currency and current admin config, even if the frontend is stale.
        if not method_can_checkout(provider, order.currency):
            return Response(
                {"error": "Este método de pago no está disponible para la moneda del pedido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if provider in [PaymentProvider.MERCADOPAGO_CL, PaymentProvider.MERCADOPAGO_AR]:
            existing_payment = Payment.objects.filter(
                order=order, provider=provider, status=PaymentStatus.PENDING,
            ).exclude(payment_url="").order_by("-created_at").first()

            if existing_payment and existing_payment.payment_url and existing_payment.preference_id:
                data = {
                    "preference_id": existing_payment.preference_id,
                    "init_point": existing_payment.payment_url,
                }
            else:
                data = create_mercadopago_preference(order, provider)

        elif provider == PaymentProvider.PAYPAL:
            existing_payment = Payment.objects.filter(
                order=order, provider=PaymentProvider.PAYPAL, status=PaymentStatus.PENDING,
            ).exclude(preference_id="").order_by("-created_at").first()

            if existing_payment and existing_payment.preference_id and existing_payment.payment_url:
                data = {
                    "paypal_order_id": existing_payment.preference_id,
                    "approve_url": existing_payment.payment_url,
                }
            else:
                data = create_paypal_order(order)

        elif provider == PaymentProvider.GLOBAL66:
            data = get_global66_info(order)

        elif provider in (PaymentProvider.TRANSFER, PaymentProvider.PAYONEER):
            existing_payment = Payment.objects.filter(
                order=order, provider=provider, status=PaymentStatus.PENDING,
            ).first()
            if not existing_payment:
                Payment.objects.create(
                    order=order, provider=provider, amount=order.total,
                    currency=getattr(order, "currency", "CLP") or "CLP",
                    status="pending",
                )
            data = {"status": "pending", "reference": f"LEVELPRO-{str(order.id)[:8].upper()}"}

        return Response({"provider": provider, **data})

    except Exception:
        return _payment_error_response(
            "Error al procesar el pago. Intenta de nuevo.",
            operation="create", provider=provider, order_id=order_id,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def capture_paypal(request):
    """
    POST /api/v1/payments/paypal/capture/
    Body: { paypal_payment_id, payer_id }

    Captura el pago después de que el usuario aprueba en PayPal.
    """
    serializer = CapturePayPalRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Parámetros de PayPal inválidos o incompletos."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        success = capture_paypal_payment(
            serializer.validated_data["paypal_payment_id"],
            serializer.validated_data["payer_id"],
            request.user,
        )
    except Exception:
        # An SDK timeout can occur after a charge. Do not suggest paying again
        # or change payment/order status based only on a transport exception.
        return _payment_error_response(
            "No pudimos confirmar el pago de PayPal. "
            "Revisa el estado de tu orden antes de volver a pagar.",
            operation="capture", provider=PaymentProvider.PAYPAL,
        )

    if success:
        return Response({"status": "approved"})

    return Response(
        {"error": "Error al capturar el pago de PayPal."},
        status=status.HTTP_400_BAD_REQUEST
    )


def _webhook_mercadopago(request, provider):
    if not get_mp_webhook_secret(provider):
        logger.error("Webhook MP deshabilitado: falta el secreto para %s.", provider)
        return Response({"status": "webhook unavailable"}, status=503)
    if not verify_mp_webhook_signature(request, provider):
        logger.warning("Firma inválida en webhook %s, request rechazado.", provider)
        return Response({"status": "invalid signature"}, status=401)
    try:
        data = normalize_mp_webhook(request)
    except ValueError:
        return Response({"status": "invalid payload"}, status=400)

    from django.utils import timezone

    resource_id = str(data.get("data", {}).get("id") or data.get("id") or "")
    request_id = request.headers.get("x-request-id", "")
    event_id = f"{resource_id}:{request_id}" if request_id else resource_id
    topic = str(data.get("type") or data.get("topic") or "")

    # Deduplicación atómica: si ya fue procesado, responder OK inmediatamente sin reejecutar
    if PaymentWebhookEvent.objects.filter(
        provider=provider, event_id=event_id, status=WebhookEventStatus.PROCESSED
    ).exists():
        logger.info("Webhook %s ignorado por deduplicación (event_id=%s).", provider, event_id)
        return Response({"status": "ok"})

    webhook_event, _ = PaymentWebhookEvent.objects.get_or_create(
        provider=provider,
        event_id=event_id,
        defaults={
            "resource_id": resource_id,
            "topic": topic,
            "status": WebhookEventStatus.PROCESSING,
            "raw_payload": data,
        }
    )

    if webhook_event.status == WebhookEventStatus.PROCESSED:
        return Response({"status": "ok"})

    try:
        process_mercadopago_webhook(data, provider)
        webhook_event.status = WebhookEventStatus.PROCESSED
        webhook_event.processed_at = timezone.now()
        webhook_event.save(update_fields=["status", "processed_at", "updated_at"])
    except Exception as exc:
        webhook_event.status = WebhookEventStatus.ERROR
        webhook_event.error_message = str(exc)
        webhook_event.save(update_fields=["status", "error_message", "updated_at"])
        logger.exception("Error procesando webhook %s.", provider)
        return Response({"status": "error"}, status=503)

    return Response({"status": "ok"})


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def webhook_mercadopago_cl(request):
    """Notificaciones CL autenticadas por HMAC, independientemente de cookies/JWT."""
    return _webhook_mercadopago(request, PaymentProvider.MERCADOPAGO_CL)


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def webhook_mercadopago_ar(request):
    """Notificaciones AR autenticadas con el secreto de la cuenta argentina."""
    return _webhook_mercadopago(request, PaymentProvider.MERCADOPAGO_AR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_status(request, order_id):
    """
    GET /api/v1/payments/status/{order_id}/
    Retorna el estado del pago de una orden.
    """
    try:
        order = Order.objects.get(id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response(
            {"error": "Orden no encontrada."},
            status=status.HTTP_404_NOT_FOUND
        )

    payment = order.payments.order_by("-created_at").first()

    if not payment:
        return Response({"status": "no_payment"})

    return Response({
        "status":   payment.status,
        "provider": payment.provider,
        "paid_at":  payment.paid_at,
    })

@api_view(["GET"])
@permission_classes([AllowAny])
def payment_methods(request):
    """
    GET /api/v1/payments/methods/?currency=CLP
    Devuelve los métodos de pago ACTIVOS que aplican a la moneda pedida,
    más las cuentas bancarias activas de esa moneda (para transferencia).
    El checkout lee de acá — nada hardcodeado.
    """
    from .models import PaymentMethodConfig, BankAccount

    currency = (request.GET.get("currency") or "CLP").upper()

    methods = []
    for m in PaymentMethodConfig.objects.filter(is_active=True):
        if not m.available_for_currency(currency) or not method_has_payment_instructions(m.method, currency):
            continue
        methods.append({
            "id":          m.method,
            "label":       m.label or m.get_method_display(),
            "description": m.description,
        })

    # Never offer a different currency or another provider's bank account.
    manual_methods = [m["id"] for m in methods if m["id"] in ("transfer", "payoneer")]
    accounts = bank_accounts_for(currency, manual_methods)

    return Response({"methods": methods, "bank_accounts": accounts})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def transfer_instructions(request, order_id):
    try:
        order = Order.objects.get(id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Orden no encontrada."}, status=404)
    try:
        response = Response(instructions_for(order))
    except Exception:
        response = _payment_error_response(
            "No pudimos consultar las instrucciones. Revisa tu pedido antes de transferir.",
            operation="transfer_instructions", provider="manual", order_id=order_id,
        )
    response["Cache-Control"] = "private, no-store"
    return response


# ── Admin: CRUD de métodos de pago y cuentas bancarias ──────────────
from rest_framework import viewsets
from core.admin_permissions import IsAdminOrStaff
from .models import PaymentMethodConfig, BankAccount
from .serializers import PaymentMethodConfigSerializer, BankAccountSerializer


class AdminPaymentMethodViewSet(viewsets.ModelViewSet):
    """CRUD de métodos de pago para el panel admin de React."""
    queryset = PaymentMethodConfig.objects.all()
    serializer_class = PaymentMethodConfigSerializer
    permission_classes = [IsAdminOrStaff]


class AdminBankAccountViewSet(viewsets.ModelViewSet):
    """CRUD de cuentas bancarias para el panel admin de React."""
    queryset = BankAccount.objects.all()
    serializer_class = BankAccountSerializer
    permission_classes = [IsAdminOrStaff]
