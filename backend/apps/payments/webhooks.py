"""Autenticación y normalización de notificaciones de Mercado Pago."""

import hashlib
import hmac
import re
from collections.abc import Mapping

from django.conf import settings

from .models import PaymentProvider


def get_mp_webhook_secret(provider: str) -> str:
    setting = {
        PaymentProvider.MERCADOPAGO_CL: "MP_CL_WEBHOOK_SECRET",
        PaymentProvider.MERCADOPAGO_AR: "MP_AR_WEBHOOK_SECRET",
    }.get(provider)
    secret = getattr(settings, setting, "") if setting else ""
    return secret if isinstance(secret, str) and secret.strip() else ""


def _query_value(request, name):
    values = request.query_params.getlist(name)
    if len(values) > 1:
        raise ValueError("Parámetro repetido")
    return values[0] if values else None


def _normalize_id(value):
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        raise ValueError("ID inválido")
    value = str(value)
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", value):
        raise ValueError("ID inválido")
    value = value.lower()  # MP normaliza los IDs alfanuméricos en el manifiesto.
    return value


def get_mp_webhook_resource_id(request) -> str:
    """El ID de la URL se usa tanto en la firma como en la consulta a MP."""
    values = [_query_value(request, name) for name in ("data.id", "id")]
    ids = {_normalize_id(value) for value in values if value is not None}
    if len(ids) != 1:
        raise ValueError("ID ausente o ambiguo")
    return ids.pop()


def verify_mp_webhook_signature(request, provider: str) -> bool:
    """Falla cerrado: requiere secreto, ID, request-id y HMAC-SHA256 válido.

    Conserva el alias de URL ?id=, pero no admite IPN sin firma verificable.
    El cuerpo no participa en la selección del recurso firmado.
    """
    secret = get_mp_webhook_secret(provider)
    if not secret:
        return False

    signature = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")
    if not signature or len(signature) > 2048:
        return False
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,255}", request_id):
        return False

    parts = {}
    for part in signature.split(","):
        key, separator, value = part.strip().partition("=")
        key, value = key.strip(), value.strip()
        if not separator or not key or not value or key in parts:
            return False
        parts[key] = value
    ts, digest = parts.get("ts", ""), parts.get("v1", "")
    # Admitir timestamps en segundos o milisegundos sin alterar lo firmado.
    if not re.fullmatch(r"[0-9]{1,16}", ts) or int(ts) <= 0:
        return False
    if not re.fullmatch(r"[a-fA-F0-9]{64}", digest):
        return False
    try:
        resource_id = get_mp_webhook_resource_id(request)
    except ValueError:
        return False

    manifest = f"id:{resource_id};request-id:{request_id};ts:{ts};"
    expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, digest.lower())


def normalize_mp_webhook(request) -> dict:
    """Construye el payload con el ID validado; nunca mezcla dicts arbitrarios."""
    resource_id = get_mp_webhook_resource_id(request)
    body = request.data
    if not isinstance(body, Mapping):
        raise ValueError("El cuerpo debe ser un objeto")
    if "data" in body:
        if not isinstance(body["data"], Mapping):
            raise ValueError("data debe ser un objeto")
        if "id" in body["data"] and _normalize_id(body["data"]["id"]) != resource_id:
            raise ValueError("El cuerpo no coincide con el recurso firmado")

    topics = [
        _query_value(request, "type"), _query_value(request, "topic"),
        body.get("type"), body.get("topic"),
    ]
    topics = [topic for topic in topics if topic is not None]
    if any(not isinstance(topic, str) or not topic or len(topic) > 64 for topic in topics):
        raise ValueError("Tipo de evento inválido")
    if len(set(topics)) != 1:
        raise ValueError("Tipo de evento ausente o ambiguo")

    # El id de nivel superior del JSON es el de la notificación, no el pago.
    return {"type": topics[0], "data": {"id": resource_id}}
