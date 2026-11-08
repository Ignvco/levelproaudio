"""
apps/billing/shipping_and_tax.py — Logística regional y soporte tributario transfronterizo (V3.3 Módulo 3).

Chile (CL) & Argentina (AR):
- Cálculo dinámico de cotizaciones de flete (Chilexpress, Starken, Andreani, Correo Argentino).
- Validación de identificadores fiscales (RUT Módulo 11 y CUIT AFIP Módulo 11).
- Generación y desglose de comprobantes DTE (SII Chile) y Facturas A/B (AFIP Argentina).
"""
import re
from decimal import Decimal
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

def generate_sii_dte_payload(order, buyer_tax_id: str, buyer_name: str, dte_type: str = "33") -> dict:
    """
    Genera el esquema estructurado para emisión de DTE del Servicio de Impuestos Internos (SII) de Chile.
    dte_type: '33' (Factura Electrónica), '39' (Boleta Electrónica).
    Invariante: Exclusivo para órdenes en CLP.
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
        "tipo_dte": int(dte_type),
        "emisor": {
            "rut": "77.890.123-4",
            "razon_social": "LEVELPRO AUDIO SPA",
            "giro": "Venta al por mayor y menor de instrumentos y equipamiento de audio",
            "comuna": "Providencia",
            "ciudad": "Santiago",
        },
        "receptor": {
            "rut": clean_tax_id(buyer_tax_id),
            "razon_social": buyer_name.strip(),
            "direccion": order.shipping_address or "Santiago, Chile",
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


def generate_afip_invoice_payload(order, cuit: str, recipient_name: str, invoice_type: str = "A") -> dict:
    """
    Genera el esquema para factura electrónica AFIP / ARCA de Argentina.
    invoice_type: 'A' (Responsable Inscripto), 'B' (Consumidor Final).
    Invariante: Denominado en ARS o USD.
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
        "tipo_comprobante": 1 if invoice_type == "A" else 6,  # 1 = Factura A, 6 = Factura B
        "punto_de_venta": 1,
        "emisor": {
            "cuit": "30718901231",
            "razon_social": "LEVELPRO AUDIO ARGENTINA S.R.L.",
            "condicion_iva": "Responsable Inscripto",
        },
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

@api_view(["POST"])
@permission_classes([AllowAny])
def estimate_shipping_rates(request):
    """
    POST /api/v1/billing/shipping/estimate/
    Cotización de flete automatizada para Chile y Argentina con tiempos de tránsito.
    """
    country   = (request.data.get("country") or "CL").strip().upper()
    city      = (request.data.get("city") or request.data.get("commune") or "Metropolitana").strip()
    currency  = (request.data.get("currency") or ("CLP" if country == "CL" else "ARS")).strip().upper()

    try:
        weight_kg = max(Decimal("0.5"), Decimal(str(request.data.get("weight_kg", 1.0))))
    except (ValueError, TypeError):
        weight_kg = Decimal("1.0")

    if country == "CL" and currency not in ("CLP", "USD"):
        return Response({"error": "Envíos en Chile admiten cotización en CLP o USD."}, status=status.HTTP_400_BAD_REQUEST)

    if country == "AR" and currency not in ("ARS", "USD"):
        return Response({"error": "Envíos en Argentina admiten cotización en ARS o USD."}, status=status.HTTP_400_BAD_REQUEST)

    rates = []
    if country == "CL":
        # Tarifas Chile en CLP
        factor = Decimal("1.0") if currency == "CLP" else Decimal("0.00105")  # ~950 CLP/USD

        # 1. Chilexpress Estándar
        price_std = (Decimal("4990") + (weight_kg * Decimal("1200"))) * factor
        rates.append({
            "carrier_code": "chilexpress",
            "service_name": "Chilexpress Estándar",
            "delivery_window": "2 a 3 días hábiles",
            "price": float(price_std.quantize(Decimal("1") if currency == "CLP" else Decimal("0.01"))),
            "currency": currency,
            "tracking_available": True,
        })
        # 2. Chilexpress Express
        price_exp = (Decimal("7990") + (weight_kg * Decimal("2000"))) * factor
        rates.append({
            "carrier_code": "chilexpress",
            "service_name": "Chilexpress Día Hábil Siguiente",
            "delivery_window": "24 horas hábiles",
            "price": float(price_exp.quantize(Decimal("1") if currency == "CLP" else Decimal("0.01"))),
            "currency": currency,
            "tracking_available": True,
        })
        # 3. Starken Agencia
        price_sta = (Decimal("3990") + (weight_kg * Decimal("1000"))) * factor
        rates.append({
            "carrier_code": "starken",
            "service_name": "Starken Retiro en Sucursal",
            "delivery_window": "2 a 4 días hábiles",
            "price": float(price_sta.quantize(Decimal("1") if currency == "CLP" else Decimal("0.01"))),
            "currency": currency,
            "tracking_available": True,
        })
    elif country == "AR":
        # Tarifas Argentina en ARS
        factor = Decimal("1.0") if currency == "ARS" else Decimal("0.00085")

        # 1. Andreani Domicilio
        price_and = (Decimal("12500") + (weight_kg * Decimal("3000"))) * factor
        rates.append({
            "carrier_code": "andreani",
            "service_name": "Andreani Estándar a Domicilio",
            "delivery_window": "3 a 5 días hábiles",
            "price": float(price_and.quantize(Decimal("1") if currency == "ARS" else Decimal("0.01"))),
            "currency": currency,
            "tracking_available": True,
        })
        # 2. Correo Argentino
        price_ca = (Decimal("9500") + (weight_kg * Decimal("2200"))) * factor
        rates.append({
            "carrier_code": "correo_argentino",
            "service_name": "Correo Argentino Sucursal",
            "delivery_window": "4 a 6 días hábiles",
            "price": float(price_ca.quantize(Decimal("1") if currency == "ARS" else Decimal("0.01"))),
            "currency": currency,
            "tracking_available": True,
        })

    return Response({
        "country": country,
        "destination": city,
        "currency": currency,
        "weight_kg": float(weight_kg),
        "rates": rates,
    })


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
