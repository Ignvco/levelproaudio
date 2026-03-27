# apps/payments/views.py

import json
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from apps.orders.models import Order
from .models import PaymentProvider
from .services import (
    create_mercadopago_preference,
    process_mercadopago_webhook,
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

        return Response({"provider": provider, **data})

    except Exception as e:
        logger.error(f"Error creando pago {provider}: {e}")
        return Response(
            {"error": "Error al procesar el pago. Intenta de nuevo."},
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

    success = capture_paypal_payment(paypal_payment_id, payer_id)

    if success:
        return Response({"status": "approved"})

    return Response(
        {"error": "Error al capturar el pago de PayPal."},
        status=status.HTTP_400_BAD_REQUEST
    )


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def webhook_mercadopago_cl(request):
    """
    POST /api/v1/payments/webhook/mercadopago/cl/
    Webhook de MercadoPago Chile — recibe notificaciones IPN.
    AllowAny porque MP no se puede autenticar con JWT.
    """
    try:
        data = request.data
        process_mercadopago_webhook(data, PaymentProvider.MERCADOPAGO_CL)
        return Response({"status": "ok"})
    except Exception as e:
        logger.error(f"Error webhook MP CL: {e}")
        return Response({"status": "error"}, status=400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def webhook_mercadopago_ar(request):
    """
    POST /api/v1/payments/webhook/mercadopago/ar/
    Webhook de MercadoPago Argentina.
    """
    try:
        data = request.data
        process_mercadopago_webhook(data, PaymentProvider.MERCADOPAGO_AR)
        return Response({"status": "ok"})
    except Exception as e:
        logger.error(f"Error webhook MP AR: {e}")
        return Response({"status": "error"}, status=400)


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