# apps/payments/views.py

import json
import logging
import traceback
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, renderer_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from apps.orders.models import Order
from .models import PaymentProvider
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_payment(request):
    """
    POST /api/v1/payments/create/
    Body: { order_id, provider }

    Crea la intención de pago según el proveedor elegido.
    """
    order_id = request.data.get("order_id")
    provider = request.data.get("provider")

    VALID_PROVIDERS = [
        PaymentProvider.MERCADOPAGO_CL,
        PaymentProvider.MERCADOPAGO_AR,
        PaymentProvider.PAYPAL,
        PaymentProvider.GLOBAL66,
        PaymentProvider.TRANSFER,
        PaymentProvider.PAYONEER,
    ]

    if provider not in VALID_PROVIDERS:
        return Response(
            {"error": f"Proveedor inválido. Opciones: {VALID_PROVIDERS}"},
            status=status.HTTP_400_BAD_REQUEST
        )

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

    try:
        if provider in [PaymentProvider.MERCADOPAGO_CL, PaymentProvider.MERCADOPAGO_AR]:
            data = create_mercadopago_preference(order, provider)

        elif provider == PaymentProvider.PAYPAL:
            data = create_paypal_order(order)

        elif provider == PaymentProvider.GLOBAL66:
            data = get_global66_info(order)

        elif provider in (PaymentProvider.TRANSFER, PaymentProvider.PAYONEER):
            # Transferencia (local o Payoneer/internacional USD): no hay
            # pasarela externa que confirme sola. Se registra el pago como
            # pendiente; el admin lo aprueba a mano cuando recibe el
            # comprobante (mismo flujo que los pagos manuales).
            from .models import Payment
            Payment.objects.create(
                order=order, provider=provider, amount=order.total,
                currency=getattr(order, "currency", "CLP") or "CLP",
                status="pending",
            )
            data = {"status": "pending", "reference": f"LEVELPRO-{str(order.id)[:8].upper()}"}

        return Response({"provider": provider, **data})

    except Exception as e:
        import traceback
        logger.error(f"Error creando pago {provider}: {e}\n{traceback.format_exc()}")
        return Response(
            {
                "error": "Error al procesar el pago. Intenta de nuevo.",
                "detail": str(e),  # detalle real para diagnóstico (config MP/PayPal)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def capture_paypal(request):
    """
    POST /api/v1/payments/paypal/capture/
    Body: { paypal_payment_id, payer_id }

    Captura el pago después de que el usuario aprueba en PayPal.
    """
    paypal_payment_id = request.data.get("paypal_payment_id")
    payer_id          = request.data.get("payer_id")

    if not paypal_payment_id or not payer_id:
        return Response(
            {"error": "Faltan parámetros."},
            status=status.HTTP_400_BAD_REQUEST
        )

    success = capture_paypal_payment(paypal_payment_id, payer_id, request.user)

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
    try:
        process_mercadopago_webhook(data, provider)
    except Exception:
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
        if not m.available_for_currency(currency):
            continue
        methods.append({
            "id":          m.method,
            "label":       m.label or m.get_method_display(),
            "description": m.description,
        })

    # Cuentas bancarias — solo relevantes si transferencia está activa
    accounts = []
    transfer_active = PaymentMethodConfig.objects.filter(
        method="transfer", is_active=True).exists()
    if transfer_active:
        qs = BankAccount.objects.filter(is_active=True)
        # Mostramos las de la moneda pedida; si no hay ninguna en esa
        # moneda, mostramos todas (mejor dar opciones que dejar vacío).
        by_currency = qs.filter(currency__iexact=currency)
        source = by_currency if by_currency.exists() else qs
        for a in source:
            accounts.append({
                "id":            str(a.id),
                "label":         a.label,
                "currency":      a.currency,
                "bank_name":     a.bank_name,
                "account_type":  a.account_type,
                "account_number": a.account_number,
                "holder_name":   a.holder_name,
                "holder_id":     a.holder_id,
                "email":         a.email,
                "instructions":  a.instructions,
            })

    return Response({"methods": methods, "bank_accounts": accounts})


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
