# apps/payments/views.py

import json
import logging
import traceback
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.renderers import JSONRenderer
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
@renderer_classes([JSONRenderer])
@permission_classes([AllowAny])
def payment_diagnostics(request):
    """
    GET /api/v1/payments/diagnostics/?key=<DIAGNOSTICS_KEY>   (o logueado como staff)
    Verifica la configuración de pagos y prueba MP + PayPal con las
    credenciales reales, devolviendo el error exacto si algo falla.
    Nunca lanza 500: cualquier fallo se devuelve como JSON legible.
    """
    from django.conf import settings as s

    try:
        # ── Control de acceso: staff O key correcta ──
        user = getattr(request, "user", None)
        is_staff = bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))
        key_ok = request.GET.get("key") and request.GET.get("key") == getattr(s, "DIAGNOSTICS_KEY", None)
        if not (is_staff or key_ok):
            return Response(
                {"error": "Acceso denegado. Logueate como admin o agregá ?key=<DIAGNOSTICS_KEY> a la URL."},
                status=status.HTTP_403_FORBIDDEN,
            )

        def _mask(v):
            if not v:
                return None
            v = str(v)
            return f"{v[:4]}…{v[-4:]} (len {len(v)})" if len(v) > 8 else "set"

        report = {
            "config": {
                "FRONTEND_URL":         getattr(s, "FRONTEND_URL", None),
                "BACKEND_URL":          getattr(s, "BACKEND_URL", None),
                "PAYPAL_MODE":          getattr(s, "PAYPAL_MODE", None),
                "MP_CL_ACCESS_TOKEN":   _mask(getattr(s, "MP_CL_ACCESS_TOKEN", "")),
                "MP_AR_ACCESS_TOKEN":   _mask(getattr(s, "MP_AR_ACCESS_TOKEN", "")),
                "PAYPAL_CLIENT_ID":     _mask(getattr(s, "PAYPAL_CLIENT_ID", "")),
                "PAYPAL_CLIENT_SECRET": _mask(getattr(s, "PAYPAL_CLIENT_SECRET", "")),
            },
            "tests": {},
        }

        # ── Test MercadoPago (CL y AR) ──
        for prov_key, token in [("mercadopago_cl", getattr(s, "MP_CL_ACCESS_TOKEN", "")),
                                ("mercadopago_ar", getattr(s, "MP_AR_ACCESS_TOKEN", ""))]:
            if not token:
                report["tests"][prov_key] = {"ok": False, "error": "Access token no configurado"}
                continue
            try:
                import mercadopago
                sdk = mercadopago.SDK(token)
                currency = "ARS" if prov_key == "mercadopago_ar" else "CLP"
                pref = {
                    "items": [{"title": "Test", "quantity": 1, "unit_price": 1000.0, "currency_id": currency}],
                    "back_urls": {
                        "success": f"{s.FRONTEND_URL}/payment/success",
                        "failure": f"{s.FRONTEND_URL}/payment/failure",
                        "pending": f"{s.FRONTEND_URL}/payment/pending",
                    },
                }
                if "localhost" not in str(s.FRONTEND_URL):
                    pref["auto_return"] = "approved"
                result = sdk.preference().create(pref)
                if result.get("status") == 201:
                    report["tests"][prov_key] = {"ok": True, "status": 201}
                else:
                    report["tests"][prov_key] = {"ok": False, "status": result.get("status"),
                                                 "error": str(result.get("response"))[:800]}
            except Exception as e:
                report["tests"][prov_key] = {"ok": False, "error": str(e)}

        # ── Test PayPal ──
        if not getattr(s, "PAYPAL_CLIENT_ID", "") or not getattr(s, "PAYPAL_CLIENT_SECRET", ""):
            report["tests"]["paypal"] = {"ok": False, "error": "Client ID/Secret no configurado"}
        else:
            try:
                import paypalrestsdk
                paypalrestsdk.configure({
                    "mode": s.PAYPAL_MODE,
                    "client_id": s.PAYPAL_CLIENT_ID,
                    "client_secret": s.PAYPAL_CLIENT_SECRET,
                })
                payment = paypalrestsdk.Payment({
                    "intent": "sale",
                    "payer": {"payment_method": "paypal"},
                    "redirect_urls": {
                        "return_url": f"{s.FRONTEND_URL}/payment/success",
                        "cancel_url": f"{s.FRONTEND_URL}/payment/failure",
                    },
                    "transactions": [{
                        "amount": {"total": "1.00", "currency": "USD"},
                        "description": "Test",
                    }],
                })
                if payment.create():
                    report["tests"]["paypal"] = {"ok": True}
                else:
                    report["tests"]["paypal"] = {"ok": False, "error": str(payment.error)[:800]}
            except Exception as e:
                report["tests"]["paypal"] = {"ok": False, "error": str(e)}

        return Response(report)

    except Exception as e:
        logger.error(f"Error en payment_diagnostics: {e}\n{traceback.format_exc()}")
        return Response(
            {"fatal": str(e), "trace": traceback.format_exc()[-1500:]},
            status=status.HTTP_200_OK,  # 200 para que se lea el detalle en el browser
        )



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