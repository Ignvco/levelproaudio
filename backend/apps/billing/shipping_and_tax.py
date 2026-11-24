"""
apps/billing/shipping_and_tax.py — Logística regional y soporte tributario transfronterizo (V3.3 Módulo 3).

Chile (CL) & Argentina (AR):
- Cálculo dinámico de cotizaciones de flete (Chilexpress, Starken, Andreani, Correo Argentino).
- Validación de identificadores fiscales (RUT Módulo 11 y CUIT AFIP Módulo 11).
- Generación y desglose de comprobantes DTE (SII Chile) y Facturas A/B (AFIP Argentina).
"""
import re
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiTypes
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


# ═══════════════════════════════════════════════════════════════
# 1. ALGORITMOS DE VALIDACIÓN FISCAL
# ═══════════════════════════════════════════════════════════════

def clean_tax_id(tax_id: str) -> str:
    """Elimina puntos, espacios y guiones."""
    return re.sub(r"[^0-9Kk]", "", str(tax_id or "")).upper()


def validate_chilean_rut(rut_str: str) -> bool:
    """
    Valida un RUT chileno mediante el algoritmo oficial Módulo 11.
    Ej: 76.123.456-7, 12345678-K.
    """
    cleaned = clean_tax_id(rut_str)
    if len(cleaned) < 8 or len(cleaned) > 9:
        return False

    body = cleaned[:-1]
    dv = cleaned[-1]

    if not body.isdigit():
        return False

    # Multiplicadores 2, 3, 4, 5, 6, 7 cíclicos de derecha a izquierda
    multipliers = [2, 3, 4, 5, 6, 7]
    total = sum(int(digit) * multipliers[i % 6] for i, digit in enumerate(reversed(body)))
    expected_remainder = 11 - (total % 11)

    if expected_remainder == 11:
        expected_dv = "0"
    elif expected_remainder == 10:
        expected_dv = "K"
    else:
        expected_dv = str(expected_remainder)

    return dv == expected_dv


def validate_argentine_cuit(cuit_str: str) -> bool:
    """
    Valida un CUIT/CUIL argentino mediante el algoritmo Módulo 11 de AFIP.
    Ej: 30-71234567-8.
    """
    cleaned = re.sub(r"[^0-9]", "", str(cuit_str or ""))
    if len(cleaned) != 11:
        return False

    # Prefijos válidos AFIP: 20, 23, 24, 27, 30, 33, 34
    prefix = cleaned[:2]
    if prefix not in ("20", "23", "24", "27", "30", "33", "34"):
        return False

    multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(cleaned[i]) * multipliers[i] for i in range(10))
    remainder = total % 11
    expected_check = 0 if remainder == 0 else (9 if remainder == 1 else 11 - remainder)

    return int(cleaned[10]) == expected_check


# ═══════════════════════════════════════════════════════════════
# 2. GENERADORES DE COMPROBANTES TRIBUTARIOS
# ═══════════════════════════════════════════════════════════════

def _resolve_configured_emitter(emitter_config: dict = None) -> dict:
    """
    FIN9-PF-04: Evita datos fiscales ficticios predeterminados.
    Solo retorna datos de emisor cuando provienen de configuración explícita autorizada.
    """
    from django.conf import settings
    cfg = emitter_config or getattr(settings, "BILLING_EMITTER_INFO", None) or {}
    if not cfg or not cfg.get("tax_id") or not cfg.get("legal_name"):
        return {
            "configured": False,
            "legal_status": "api_ready_draft_only_unconfigured_emitter",
        }
    return {
        "configured": True,
        "tax_id": str(cfg["tax_id"]),
        "razon_social": str(cfg["legal_name"]),
        "giro": str(cfg.get("business_activity") or ""),
        "comuna": str(cfg.get("commune") or ""),
        "ciudad": str(cfg.get("city") or ""),
    }


def generate_sii_dte_payload(order, buyer_tax_id: str, buyer_name: str, dte_type: str = "33", emitter_config: dict = None) -> dict:
    """
    FIN9-PF-04: Esquema API-ready referencial (NO emite folios oficiales, NO firma XML ni transmite al SII).
    """
    if (order.currency or "").upper() != "CLP":
        raise ValueError("Los documentos tributarios chilenos (SII) deben emitirse exclusivamente en CLP.")

    if not validate_chilean_rut(buyer_tax_id):
        raise ValueError(f"RUT comprador inválido: {buyer_tax_id}")

    total_gross = Decimal(str(order.total))
    # IVA 19% en Chile
    net_amount = (total_gross / Decimal("1.19")).quantize(Decimal("1"))
    iva_amount = total_gross - net_amount

    return {
        "sii_version": "1.0",
        "api_ready_draft_only": True,
        "dte_emitted": False,
        "transmitted_to_authority": False,
        "is_legal_dte": False,
        "tipo_dte": int(dte_type),
        "emisor": _resolve_configured_emitter(emitter_config),
        "receptor": {
            "rut": clean_tax_id(buyer_tax_id),
            "razon_social": buyer_name.strip(),
            "direccion": order.shipping_address or "",
        },
        "totales": {
            "moneda": "CLP",
            "monto_neto": int(net_amount),
            "tasa_iva": 19.0,
            "monto_iva": int(iva_amount),
            "monto_total": int(total_gross),
        },
        "orden_referencia": {
            "order_id": str(order.id),
            "tracking_number": getattr(order, "tracking_number", None),
        },
    }


def generate_afip_invoice_payload(order, cuit: str, recipient_name: str, invoice_type: str = "A", emitter_config: dict = None) -> dict:
    """
    FIN9-PF-04: Esquema API-ready referencial AFIP/ARCA (NO emite ni transmite).
    """
    currency = (order.currency or "").upper()
    if currency not in ("ARS", "USD"):
        raise ValueError("Las facturas AFIP deben denominarse en ARS o USD.")

    if invoice_type == "A" and not validate_argentine_cuit(cuit):
        raise ValueError(f"CUIT inválido para Factura A: {cuit}")

    total_gross = Decimal(str(order.total))
    # IVA 21% general en Argentina
    net_amount = (total_gross / Decimal("1.21")).quantize(Decimal("0.01"))
    iva_amount = total_gross - net_amount

    return {
        "afip_wsfe_version": "2.0",
        "api_ready_draft_only": True,
        "dte_emitted": False,
        "transmitted_to_authority": False,
        "is_legal_dte": False,
        "tipo_comprobante": 1 if invoice_type == "A" else 6,  # 1 = Factura A, 6 = Factura B
        "punto_de_venta": 1,
        "emisor": _resolve_configured_emitter(emitter_config),
        "receptor": {
            "cuit": re.sub(r"[^0-9]", "", str(cuit)),
            "razon_social": recipient_name.strip(),
            "condicion_iva": "Responsable Inscripto" if invoice_type == "A" else "Consumidor Final",
        },
        "totales": {
            "moneda": currency,
            "monto_neto": float(net_amount),
            "alicuota_iva": 21.0,
            "importe_iva": float(iva_amount),
            "monto_total": float(total_gross),
        },
        "orden_referencia": {
            "order_id": str(order.id),
        },
    }


# ═══════════════════════════════════════════════════════════════
# 3. ENDPOINTS API: ESTIMADOR LOGÍSTICO Y VALIDADOR FISCAL
# ═══════════════════════════════════════════════════════════════

QUOTE_CLASS_REAL_API = "real_carrier_api"
QUOTE_CLASS_CONFIGURED_TABLE = "configured_tariff_table"
QUOTE_CLASS_QA_SIMULATION = "qa_simulation"

VERSIONED_SHIPPING_TARIFFS = {
    "CL": {
        "currency": "CLP",
        "origin": "Santiago RM, CL",
        "tariff_version": "CL-2026.11-v1",
        "services": [
            {
                "carrier_code": "chilexpress",
                "service_code": "chilexpress_std",
                "service_name": "Chilexpress Estándar",
                "delivery_window": "2 a 3 días hábiles",
                "base_fee": Decimal("4990"),
                "per_kg": Decimal("1200"),
                "volumetric_divisor": Decimal("4000"),
                "rate_table_id": "TBL-CLX-STD-202611",
            },
            {
                "carrier_code": "chilexpress",
                "service_code": "chilexpress_exp",
                "service_name": "Chilexpress Día Hábil Siguiente",
                "delivery_window": "24 horas hábiles",
                "base_fee": Decimal("7990"),
                "per_kg": Decimal("2000"),
                "volumetric_divisor": Decimal("4000"),
                "rate_table_id": "TBL-CLX-EXP-202611",
            },
            {
                "carrier_code": "starken",
                "service_code": "starken_agencia",
                "service_name": "Starken Retiro en Sucursal",
                "delivery_window": "2 a 4 días hábiles",
                "base_fee": Decimal("3990"),
                "per_kg": Decimal("1000"),
                "volumetric_divisor": Decimal("4000"),
                "rate_table_id": "TBL-STK-AG-202611",
            },
        ],
    },
    "AR": {
        "currency": "ARS",
        "origin": "CABA, AR",
        "tariff_version": "AR-2026.11-v1",
        "services": [
            {
                "carrier_code": "andreani",
                "service_code": "andreani_dom",
                "service_name": "Andreani Estándar a Domicilio",
                "delivery_window": "3 a 5 días hábiles",
                "base_fee": Decimal("12500"),
                "per_kg": Decimal("3000"),
                "volumetric_divisor": Decimal("4000"),
                "rate_table_id": "TBL-AND-DOM-202611",
            },
            {
                "carrier_code": "correo_argentino",
                "service_code": "correo_ar_suc",
                "service_name": "Correo Argentino Sucursal",
                "delivery_window": "4 a 6 días hábiles",
                "base_fee": Decimal("9500"),
                "per_kg": Decimal("2200"),
                "volumetric_divisor": Decimal("5000"),
                "rate_table_id": "TBL-CA-SUC-202611",
            },
        ],
    },
}


def compute_shipping_quote_candidates(
    *,
    country: str,
    destination: str,
    currency: str,
    physical_weight_kg: Decimal,
    length_cm: Decimal = Decimal("0"),
    width_cm: Decimal = Decimal("0"),
    height_cm: Decimal = Decimal("0"),
    explicit_fx_rate: Decimal | None = None,
    quote_mode: str = QUOTE_CLASS_CONFIGURED_TABLE,
) -> list[dict]:
    """
    LOG10-PF-01: Calcula cotizaciones estructuradas sin factores FX hardcoded.
    Distingue explícitamente:
    - real_carrier_api
    - configured_tariff_table
    - qa_simulation
    """
    table = VERSIONED_SHIPPING_TARIFFS.get(country)
    if not table:
        raise ValueError(f"País '{country}' sin tabla tarifaria configurada.")

    native_currency = table["currency"]
    if currency != native_currency:
        if explicit_fx_rate is None or explicit_fx_rate <= Decimal("0"):
            raise ValueError(
                f"Cotización en {currency} para {country} requiere tarifa nativa o tasa de cambio explícita (prohibido FX hardcoded)."
            )
        fx = explicit_fx_rate
    else:
        fx = Decimal("1.0")

    now = timezone.now()
    valid_until = (now + timedelta(hours=24)).isoformat()
    phys = max(Decimal("0.50"), Decimal(str(physical_weight_kg))).quantize(Decimal("0.01"))
    has_dims = length_cm > 0 and width_cm > 0 and height_cm > 0
    volume_cm3 = (length_cm * width_cm * height_cm) if has_dims else Decimal("0")

    is_qa = quote_mode == QUOTE_CLASS_QA_SIMULATION
    verification_status = (
        "verified"
        if quote_mode == QUOTE_CLASS_REAL_API
        else ("simulated_qa_only" if is_qa else "estimated")
    )

    rates = []
    for svc in table["services"]:
        vol_weight = (
            (volume_cm3 / svc["volumetric_divisor"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if has_dims
            else Decimal("0.00")
        )
        billable = max(phys, vol_weight).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        raw_amount = (svc["base_fee"] + (billable * svc["per_kg"])) * fx
        q_step = Decimal("1") if currency == "CLP" else Decimal("0.01")
        amount = raw_amount.quantize(q_step, rounding=ROUND_HALF_UP)
        rates.append({
            "carrier_code": svc["carrier_code"],
            "service_code": svc["service_code"],
            "service_name": svc["service_name"],
            "origin": table["origin"],
            "destination": destination,
            "currency": currency,
            "physical_weight_kg": float(phys),
            "volumetric_weight_kg": float(vol_weight),
            "billable_weight_kg": float(billable),
            "delivery_window": svc["delivery_window"],
            "quoted_at": now.isoformat(),
            "quote_source": quote_mode,
            "rate_table_id": svc["rate_table_id"],
            "tariff_version": table["tariff_version"],
            "valid_until": valid_until,
            "price": float(amount),
            "verification_status": verification_status,
            "is_commercial_valid": not is_qa,
            "tracking_available": True,
        })
    return rates


@extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
@api_view(["POST"])
@permission_classes([AllowAny])
def estimate_shipping_rates(request):
    """
    POST /api/v1/billing/shipping/estimate/
    Cotización de flete automatizada para Chile y Argentina con tabla versionada (LOG10-PF-01).
    """
    country   = (request.data.get("country") or "CL").strip().upper()
    city      = (request.data.get("city") or request.data.get("commune") or "Metropolitana").strip()
    currency  = (request.data.get("currency") or ("CLP" if country == "CL" else "ARS")).strip().upper()

    try:
        weight_kg = max(Decimal("0.5"), Decimal(str(request.data.get("weight_kg", 1.0))))
    except (ValueError, TypeError):
        weight_kg = Decimal("1.0")

    fx_raw = request.data.get("explicit_fx_rate")
    explicit_fx = None
    if fx_raw is not None:
        try:
            explicit_fx = Decimal(str(fx_raw))
        except Exception:
            return Response({"error": "Tasa de cambio explícita inválida."}, status=status.HTTP_400_BAD_REQUEST)

    if country == "CL" and currency not in ("CLP", "USD"):
        return Response({"error": "Envíos en Chile admiten cotización en CLP o USD."}, status=status.HTTP_400_BAD_REQUEST)

    if country == "AR" and currency not in ("ARS", "USD"):
        return Response({"error": "Envíos en Argentina admiten cotización en ARS o USD."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        rates = compute_shipping_quote_candidates(
            country=country,
            destination=city,
            currency=currency,
            physical_weight_kg=weight_kg,
            explicit_fx_rate=explicit_fx,
            quote_mode=QUOTE_CLASS_CONFIGURED_TABLE,
        )
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "country": country,
        "destination": city,
        "currency": currency,
        "weight_kg": float(weight_kg),
        "quote_source": QUOTE_CLASS_CONFIGURED_TABLE,
        "rates": rates,
    })


@extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
@api_view(["POST"])
@permission_classes([AllowAny])
def validate_tax_id_view(request):
    """
    POST /api/v1/billing/tax/validate/
    Valida el RUT (Chile) o CUIT (Argentina) y retorna formato estandarizado.
    """
    tax_id  = request.data.get("tax_id")
    country = (request.data.get("country") or "CL").strip().upper()

    if not tax_id:
        return Response({"error": "tax_id es requerido."}, status=status.HTTP_400_BAD_REQUEST)

    if country == "CL":
        is_valid = validate_chilean_rut(tax_id)
        formatted = clean_tax_id(tax_id)
        if len(formatted) >= 8:
            formatted = f"{formatted[:-1]}-{formatted[-1]}"
        doc_type = "RUT"
    elif country == "AR":
        is_valid = validate_argentine_cuit(tax_id)
        digits = re.sub(r"[^0-9]", "", str(tax_id))
        formatted = f"{digits[:2]}-{digits[2:10]}-{digits[10:]}" if len(digits) == 11 else digits
        doc_type = "CUIT"
    else:
        return Response({"error": "País no soportado. Usa 'CL' o 'AR'."}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "tax_id": str(tax_id),
        "country": country,
        "type": doc_type,
        "is_valid": is_valid,
        "formatted": formatted if is_valid else str(tax_id),
    })
