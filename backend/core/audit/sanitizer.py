# core/audit/sanitizer.py
"""Motor de sanitización recursiva, cómputo de diferencias (diff) y enmascaramiento dinámico RBAC."""

from decimal import Decimal
import datetime
import uuid
from .constants import SENSITIVE_FIELD_NAMES, FINANCIAL_MASK_KEYS


def _is_sensitive_key(key: str) -> bool:
    if not isinstance(key, str):
        return False
    k = key.lower().replace("-", "_").replace(" ", "_")
    return any(sens in k for sens in SENSITIVE_FIELD_NAMES)


def _serialize_primitive(val):
    if val is None or isinstance(val, (bool, int, float, str)):
        if isinstance(val, str) and len(val) > 4000:
            return val[:4000] + "... [TRUNCADO]"
        return val
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return val.isoformat()
    if isinstance(val, uuid.UUID):
        return str(val)
    if hasattr(val, "pk"):
        return str(val.pk)
    return str(val)


def sanitize_audit_payload(obj, max_depth=6):
    """
    Sanitiza recursivamente un diccionario, lista o valor para auditoría.
    Elimina contraseñas, tokens, llaves de API, credenciales y trunca cadenas excesivas.
    """
    if max_depth <= 0:
        return "[PROFUNDIDAD MÁXIMA ALCANZADA]"

    if isinstance(obj, dict):
        sanitized = {}
        for k, v in obj.items():
            str_key = str(k)
            if _is_sensitive_key(str_key):
                sanitized[str_key] = "[REDACTED]"
            else:
                sanitized[str_key] = sanitize_audit_payload(v, max_depth=max_depth - 1)
        return sanitized

    if isinstance(obj, (list, tuple, set)):
        return [sanitize_audit_payload(item, max_depth=max_depth - 1) for item in obj]

    return _serialize_primitive(obj)


def compute_state_diff(before_dict, after_dict, ignore_keys=None):
    """
    Calcula la diferencia de estado entre dos diccionarios o estados de modelo.
    Retorna (previous_values, new_values, changed_fields).
    """
    ignore_keys = set(ignore_keys or [])
    ignore_keys.update({"updated_at", "last_login", "_state"})

    clean_before = sanitize_audit_payload(before_dict or {})
    clean_after = sanitize_audit_payload(after_dict or {})

    all_keys = set(clean_before.keys()).union(set(clean_after.keys()))
    previous_values = {}
    new_values = {}
    changed_fields = []

    for k in sorted(all_keys):
        if k in ignore_keys:
            continue
        val_before = clean_before.get(k)
        val_after = clean_after.get(k)
        if val_before != val_after:
            changed_fields.append(k)
            if k in clean_before:
                previous_values[k] = val_before
            if k in clean_after:
                new_values[k] = val_after

    return previous_values, new_values, changed_fields


def mask_payload_financial_data(
    payload,
    can_view_costs: bool = False,
    can_view_margins: bool = False,
    can_view_finances: bool = False,
    max_depth: int = 6,
):
    """
    Enmascara dinámicamente claves financieras en payloads de auditoría
    cuando el usuario consultante carece de los permisos correspondientes.
    """
    if not isinstance(payload, (dict, list)) or max_depth <= 0:
        return payload

    if isinstance(payload, list):
        return [
            mask_payload_financial_data(
                item,
                can_view_costs=can_view_costs,
                can_view_margins=can_view_margins,
                can_view_finances=can_view_finances,
                max_depth=max_depth - 1,
            )
            for item in payload
        ]

    masked = {}
    cost_keys = {
        "cost_price", "cost", "costo", "total_cost", "costo_total",
        "capital_cost", "valor_inventario", "cost_missing_count",
    }
    margin_keys = {
        "margin", "margen", "profit", "ganancia", "utilidad",
        "net_profit", "utilidad_neta",
    }
    finance_keys = {"withdrawal_amount", "distributions"}

    for k, v in payload.items():
        str_k = str(k).lower()
        if (not can_view_costs) and (str_k in cost_keys):
            masked[k] = "[RESTRINGIDO]"
        elif (not can_view_margins) and (str_k in margin_keys):
            masked[k] = "[RESTRINGIDO]"
        elif (not can_view_finances) and (str_k in finance_keys):
            masked[k] = "[RESTRINGIDO]"
        elif isinstance(v, (dict, list)):
            masked[k] = mask_payload_financial_data(
                v,
                can_view_costs=can_view_costs,
                can_view_margins=can_view_margins,
                can_view_finances=can_view_finances,
                max_depth=max_depth - 1,
            )
        else:
            masked[k] = v

    return masked


def sanitize_csv_cell(value) -> str:
    """
    Previene inyección de fórmulas CSV (CWE-1236 / Formula Injection).
    Si el valor comienza con '=', '+', '-', '@', tab o retorno de carro,
    antepone una comilla simple (') para forzar interpretación como texto plano en hojas de cálculo.
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{val_str}"
    return val_str
