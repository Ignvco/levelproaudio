# apps/orders/courier_adapters.py
"""
LEVELPRO OS V4.0 — GATE 10: COURIER ADAPTER CONTRACT (BF-25)
- Adaptadores desacoplados para Chilexpress, Starken, Andreani y Correo Argentino.
- En QA y sin credenciales comerciales activas operan mediante SimulatedCourierAdapter
  con marca explícita integration_pending / simulated_qa.
- Nunca invoca APIs de producción en QA ni expone credenciales en frontend.
"""

from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import secrets
from typing import Optional
from django.utils import timezone

from apps.billing.shipping_and_tax import (
    QUOTE_CLASS_QA_SIMULATION,
    compute_shipping_quote_candidates,
)
from apps.orders.logistics_models import Carrier, CarrierService, TrackingEvent


CARRIER_CATALOG_SPEC = [
    {
        "code": "chilexpress",
        "name": "Chilexpress",
        "country": "CL",
        "integration_status": Carrier.IntegrationStatus.INTEGRATION_PENDING,
        "docs_url": "https://developers.wschilexpress.com/",
        "volumetric_divisor": Decimal("4000.00"),
        "services": [
            ("chilexpress_std", "Chilexpress Estándar", "2 a 3 días hábiles", Decimal("4990"), Decimal("1200"), "CLP", "TBL-CLX-STD-202611", "CL-2026.11-v1"),
            ("chilexpress_exp", "Chilexpress Día Hábil Siguiente", "24 horas hábiles", Decimal("7990"), Decimal("2000"), "CLP", "TBL-CLX-EXP-202611", "CL-2026.11-v1"),
        ],
    },
    {
        "code": "starken",
        "name": "Starken",
        "country": "CL",
        "integration_status": Carrier.IntegrationStatus.INTEGRATION_PENDING,
        "docs_url": "https://developers.starken.cl/",
        "volumetric_divisor": Decimal("4000.00"),
        "services": [
            ("starken_agencia", "Starken Retiro en Sucursal", "2 a 4 días hábiles", Decimal("3990"), Decimal("1000"), "CLP", "TBL-STK-AG-202611", "CL-2026.11-v1"),
        ],
    },
    {
        "code": "andreani",
        "name": "Andreani",
        "country": "AR",
        "integration_status": Carrier.IntegrationStatus.INTEGRATION_PENDING,
        "docs_url": "https://developers.andreani.com/",
        "volumetric_divisor": Decimal("4000.00"),
        "services": [
            ("andreani_dom", "Andreani Estándar a Domicilio", "3 a 5 días hábiles", Decimal("12500"), Decimal("3000"), "ARS", "TBL-AND-DOM-202611", "AR-2026.11-v1"),
        ],
    },
    {
        "code": "correo_argentino",
        "name": "Correo Argentino (MiCorreo / PAQ.AR)",
        "country": "AR",
        "integration_status": Carrier.IntegrationStatus.INTEGRATION_PENDING,
        "docs_url": "https://www.correoargentino.com.ar/MiCorreo/",
        "volumetric_divisor": Decimal("5000.00"),
        "services": [
            ("correo_ar_suc", "Correo Argentino Sucursal", "4 a 6 días hábiles", Decimal("9500"), Decimal("2200"), "ARS", "TBL-CA-SUC-202611", "AR-2026.11-v1"),
        ],
    },
]


def ensure_default_carriers_seeded() -> list[Carrier]:
    """Siembra idempotente de transportistas oficiales del Roadmap sin credenciales productivas."""
    carriers = []
    for spec in CARRIER_CATALOG_SPEC:
        c, _ = Carrier.objects.get_or_create(
            code=spec["code"],
            defaults={
                "name": spec["name"],
                "country": spec["country"],
                "integration_status": spec["integration_status"],
                "docs_url": spec["docs_url"],
                "volumetric_divisor": spec["volumetric_divisor"],
                "is_active": True,
            },
        )
        for s_code, s_name, win, base_f, per_kg, curr, tbl_id, tbl_ver in spec["services"]:
            CarrierService.objects.get_or_create(
                service_code=s_code,
                defaults={
                    "carrier": c,
                    "name": s_name,
                    "delivery_window": win,
                    "base_fee": base_f,
                    "per_kg_fee": per_kg,
                    "currency": curr,
                    "rate_table_id": tbl_id,
                    "tariff_version": tbl_ver,
                    "is_active": True,
                },
            )
        carriers.append(c)
    return carriers


EXTERNAL_EVENT_MAP = {
    "CREATED": TrackingEvent.NormalizedStatus.LABEL_CREATED,
    "LABEL_CREATED": TrackingEvent.NormalizedStatus.LABEL_CREATED,
    "AWAITING_PICKUP": TrackingEvent.NormalizedStatus.AWAITING_PICKUP,
    "PICKED_UP": TrackingEvent.NormalizedStatus.PICKED_UP,
    "RETIRADO": TrackingEvent.NormalizedStatus.PICKED_UP,
    "IN_TRANSIT": TrackingEvent.NormalizedStatus.IN_TRANSIT,
    "EN_TRANSITO": TrackingEvent.NormalizedStatus.IN_TRANSIT,
    "OUT_FOR_DELIVERY": TrackingEvent.NormalizedStatus.OUT_FOR_DELIVERY,
    "EN_REPARTO": TrackingEvent.NormalizedStatus.OUT_FOR_DELIVERY,
    "DELIVERED": TrackingEvent.NormalizedStatus.DELIVERED,
    "ENTREGADO": TrackingEvent.NormalizedStatus.DELIVERED,
    "FAILED": TrackingEvent.NormalizedStatus.DELIVERY_ATTEMPT_FAILED,
    "ATTEMPT_FAILED": TrackingEvent.NormalizedStatus.DELIVERY_ATTEMPT_FAILED,
    "RETURNED": TrackingEvent.NormalizedStatus.RETURNED_TO_SENDER,
    "EXCEPTION": TrackingEvent.NormalizedStatus.EXCEPTION,
}


class BaseCourierAdapter:
    mode = "simulated_qa"
    timeout_seconds = 10
    max_retries = 2

    def __init__(self, carrier: Carrier):
        self.carrier = carrier

    def get_rates(self, *, country: str, destination: str, currency: str, weight_kg: Decimal, length_cm: Decimal, width_cm: Decimal, height_cm: Decimal) -> dict:
        raise NotImplementedError

    def create_shipment(self, *, shipment_number: str, destination: str, currency: str) -> dict:
        raise NotImplementedError

    def get_label(self, *, tracking_number: str) -> dict:
        raise NotImplementedError

    def get_tracking(self, *, tracking_number: str) -> dict:
        raise NotImplementedError

    def cancel_shipment(self, *, external_id: str) -> dict:
        raise NotImplementedError

    def normalize_tracking_event(self, raw_code: str) -> str:
        clean = (raw_code or "").strip().upper().replace(" ", "_")
        return EXTERNAL_EVENT_MAP.get(clean, TrackingEvent.NormalizedStatus.EXCEPTION)


class SimulatedCourierAdapter(BaseCourierAdapter):
    """Adaptador simulado para QA: reproduce contratos reales sin llamadas externas."""

    def get_rates(self, *, country: str, destination: str, currency: str, weight_kg: Decimal, length_cm: Decimal, width_cm: Decimal, height_cm: Decimal) -> dict:
        all_rates = compute_shipping_quote_candidates(
            country=country,
            destination=destination,
            currency=currency,
            physical_weight_kg=weight_kg,
            length_cm=length_cm,
            width_cm=width_cm,
            height_cm=height_cm,
            quote_mode=QUOTE_CLASS_QA_SIMULATION,
        )
        filtered = [r for r in all_rates if r["carrier_code"] == self.carrier.code]
        return {
            "provider_code": self.carrier.code,
            "external_id": f"SIM-RATE-{secrets.token_hex(4).upper()}",
            "request_status": "ok",
            "error_code": "",
            "timestamp": timezone.now().isoformat(),
            "correlation_id": secrets.token_hex(8),
            "currency": currency,
            "docs_url": self.carrier.docs_url,
            "mode": "simulated_qa",
            "integration_status": self.carrier.integration_status,
            "rates": filtered,
        }

    def create_shipment(self, *, shipment_number: str, destination: str, currency: str) -> dict:
        ext_id = f"SIM-{self.carrier.code[:3].upper()}-{hashlib.sha256(shipment_number.encode()).hexdigest()[:10].upper()}"
        return {
            "provider_code": self.carrier.code,
            "external_id": ext_id,
            "tracking_number": ext_id,
            "request_status": "simulated_created",
            "error_code": "",
            "timestamp": timezone.now().isoformat(),
            "correlation_id": secrets.token_hex(8),
            "currency": currency,
            "docs_url": self.carrier.docs_url,
            "mode": "simulated_qa",
        }

    def get_label(self, *, tracking_number: str) -> dict:
        return {
            "provider_code": self.carrier.code,
            "external_id": tracking_number,
            "label_format": "internal_logistic_pdf",
            "request_status": "simulated_label",
            "error_code": "",
            "timestamp": timezone.now().isoformat(),
            "mode": "simulated_qa",
        }

    def get_tracking(self, *, tracking_number: str) -> dict:
        return {
            "provider_code": self.carrier.code,
            "external_id": tracking_number,
            "request_status": "ok",
            "error_code": "",
            "timestamp": timezone.now().isoformat(),
            "mode": "simulated_qa",
            "events": [],
        }

    def cancel_shipment(self, *, external_id: str) -> dict:
        return {
            "provider_code": self.carrier.code,
            "external_id": external_id,
            "request_status": "simulated_cancelled",
            "error_code": "",
            "timestamp": timezone.now().isoformat(),
            "mode": "simulated_qa",
        }


def get_courier_adapter(carrier: Carrier) -> BaseCourierAdapter:
    return SimulatedCourierAdapter(carrier)
