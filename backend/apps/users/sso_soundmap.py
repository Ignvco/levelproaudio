"""
apps/users/sso_soundmap.py — Integración con plataforma hermana SoundMap (V3.3 Módulo 5).

- SSO Desacoplado vía JWT firmado con HMAC-SHA256 (OIDC token exchange).
- Webhook inter-plataforma autenticado con firma criptográfica HMAC (X-SoundMap-Signature).
- Endpoint de exposición de activos de audio para SoundMap Player.
"""
import base64
import hashlib
import hmac
import json
import time
from django.conf import settings
from django.utils.encoding import force_bytes, force_str
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.products.models import Product


def _b64url_encode(data_bytes: bytes) -> str:
    return base64.urlsafe_b64encode(data_bytes).rstrip(b"=").decode("ascii")


def _b64url_decode(data_str: str) -> bytes:
    padding = 4 - (len(data_str) % 4)
    if padding and padding < 4:
        data_str += "=" * padding
    return base64.urlsafe_b64decode(data_str.encode("ascii"))


def generate_soundmap_sso_token(user, expires_in_seconds: int = 900) -> str:
    """Genera un JWT seguro firmado con HMAC-SHA256 para SSO en SoundMap."""
    secret = force_bytes(settings.SECRET_KEY)
    header = {"typ": "JWT", "alg": "HS256"}

    now = int(time.time())
    tier = getattr(getattr(user, "loyalty_account", None), "nivel", "bronze")
    name = f"{user.first_name} {user.last_name}".strip() or user.username or user.email

    payload = {
        "iss": "levelproaudio.com",
        "aud": "soundmap.app",
        "sub": str(user.id),
        "email": user.email,
        "name": name,
        "tier": tier,
        "is_staff": user.is_staff,
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    hdr_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    pld_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    to_sign = f"{hdr_b64}.{pld_b64}".encode("ascii")

    sig = hmac.new(secret, to_sign, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    return f"{hdr_b64}.{pld_b64}.{sig_b64}"


def verify_soundmap_sso_token(token: str) -> dict:
    """Valida la firma criptográfica y expiración de un token SSO de SoundMap."""
    secret = force_bytes(settings.SECRET_KEY)
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Token malformado.")

        hdr_b64, pld_b64, sig_b64 = parts
        to_verify = f"{hdr_b64}.{pld_b64}".encode("ascii")
        expected_sig = hmac.new(secret, to_verify, hashlib.sha256).digest()

        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Firma HMAC inválida.")

        payload = json.loads(_b64url_decode(pld_b64).decode("utf-8"))
        if payload.get("exp", 0) < int(time.time()):
            raise ValueError("Token expirado.")

        return payload
    except Exception as exc:
        raise ValueError(f"Validación de token fallida: {exc}")


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS API DE INTEGRACIÓN SOUNDMAP
# ═══════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def soundmap_sso_token_view(request):
    """
    POST /api/v1/auth/sso/soundmap/token/
    Genera un token de acceso federado para que el usuario ingrese a SoundMap con un solo clic.
    """
    token = generate_soundmap_sso_token(request.user, expires_in_seconds=900)
    return Response({
        "sso_token": token,
        "expires_in": 900,
        "target_url": f"https://soundmap.app/sso/callback?token={token}",
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def soundmap_webhook_view(request):
    """
    POST /api/v1/integrations/soundmap/webhook/
    Recepción de eventos desde SoundMap autenticados mediante firma HMAC-SHA256 (X-SoundMap-Signature).
    """
    signature = request.headers.get("X-SoundMap-Signature") or request.META.get("HTTP_X_SOUNDMAP_SIGNATURE")
    if not signature:
        return Response({"error": "Encabezado X-SoundMap-Signature requerido."}, status=status.HTTP_403_FORBIDDEN)

    secret = force_bytes(settings.SECRET_KEY)
    raw_body = request.body
    expected_sig = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig.lower(), signature.strip().lower()):
        return Response({"error": "Firma HMAC inválida."}, status=status.HTTP_403_FORBIDDEN)

    event_type = "unknown"
    try:
        body_json = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        event_type = body_json.get("event", "unknown")
    except Exception:
        event_type = request.data.get("event", "unknown") if hasattr(request, "data") else "unknown"

    return Response({
        "received": True,
        "event": event_type,
        "processed_at": int(time.time()),
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def soundmap_audio_assets_view(request):
    """
    GET /api/v1/integrations/soundmap/audio-assets/
    Expone muestras de audio, demos de productos y stems compatibles con SoundMap Player.
    """
    base = (getattr(settings, "SITE_URL", "") or "https://levelproaudio.com").rstrip("/")
    products = Product.objects.filter(is_active=True)[:10]

    assets = []
    for p in products:
        assets.append({
            "id": f"lpr-demo-{p.slug}",
            "title": f"Demo Acústica · {p.name}",
            "product_id": str(p.id),
            "product_slug": p.slug,
            "format": "wav",
            "sample_rate_hz": 48000,
            "bit_depth": 24,
            "channels": 2,
            "preview_url": f"{base}/media/audio/demos/{p.slug}.wav",
            "waveform_url": f"{base}/media/audio/waveforms/{p.slug}.json",
            "license": "LevelPro Royalty-Free Audio License",
        })

    return Response({
        "count": len(assets),
        "platform": "LevelPro Audio OS",
        "assets": assets,
    })
