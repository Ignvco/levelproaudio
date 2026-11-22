# apps/procurement/price_list_io.py
"""
LEVELPRO OS V4.0 — GATE 3: Importador / Exportador de Listas de Costos de Proveedores
Reutiliza los patrones de Gate 2 (pim_io):
- Soporte Excel (.xlsx) y CSV (.csv)
- Dry-run (simulación) y confirmación explícita
- Detección de duplicados en archivo y listas vencidas
- Identidad persistente vía SkuRegistry
- Prevención de Formula Injection en exportaciones
- IdempotencyContractService y Audit Trail obligatorio
- NUNCA modifica precios de venta, cost_price del catálogo ni inventario físico
"""

import csv
import datetime
import hashlib
import io
from decimal import Decimal, InvalidOperation
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError

from apps.products.models import SkuRegistry
from apps.procurement.models import Supplier, ProductSupplier, SupplierPriceHistory
from apps.procurement.services import upsert_product_supplier
from core.contracts.money import SUPPORTED_CURRENCIES
from core.contracts.idempotency import IdempotencyContractService
from core.rbac.constants import MODULE_PURCHASES, PERM_EDIT_COSTS, PERM_VIEW_COSTS, PERM_EXPORT_DATA
from core.rbac.permissions import is_effective_super_admin, user_has_capability
from core.audit.services import record_audit_event
from core.audit.constants import CATEGORY_BULK_OPERATION, SEVERITY_INFO, SEVERITY_WARNING


FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

COLUMN_ALIASES = {
    "supplier_code": "supplier_code",
    "codigo_proveedor": "supplier_code",
    "sku": "sku",
    "sku_interno": "sku",
    "supplier_sku": "supplier_sku",
    "sku_proveedor": "supplier_sku",
    "unit_cost": "unit_cost",
    "costo": "unit_cost",
    "costo_unitario": "unit_cost",
    "currency": "currency",
    "moneda": "currency",
    "tax_basis": "tax_basis",
    "base_tributaria": "tax_basis",
    "moq": "moq",
    "lead_time_days": "lead_time_days",
    "plazo_dias": "lead_time_days",
    "reported_availability": "reported_availability",
    "disponibilidad": "reported_availability",
    "reported_available_qty": "reported_available_qty",
    "cantidad_informada": "reported_available_qty",
    "cost_valid_from": "cost_valid_from",
    "vigencia_desde": "cost_valid_from",
    "cost_valid_until": "cost_valid_until",
    "vigencia_hasta": "cost_valid_until",
    "commercial_notes": "commercial_notes",
    "observaciones": "commercial_notes",
}


def sanitize_csv_cell(value):
    if value is None:
        return ""
    s = str(value)
    if s and s[0] in FORMULA_PREFIXES:
        return f"'{s}"
    return s


def _normalize_header(raw: str) -> str:
    h = str(raw or "").strip().lower().replace(" ", "_")
    return COLUMN_ALIASES.get(h, h)


def _is_empty(val) -> bool:
    return val is None or (isinstance(val, str) and val.strip() == "")


def _parse_date(val, field_name: str):
    if _is_empty(val):
        return None
    if isinstance(val, datetime.datetime):
        return val.date()
    if isinstance(val, datetime.date):
        return val
    s = str(val).strip()
    try:
        return datetime.date.fromisoformat(s)
    except ValueError:
        raise ValueError(f"{field_name}: fecha inválida '{s}' (use formato YYYY-MM-DD).")


def _read_tabular_file(file_bytes: bytes, filename: str) -> tuple[list[str], list[list]]:
    fname = (filename or "").lower()
    if fname.endswith(".xlsx"):
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
        try:
            raw_headers = next(rows_iter)
        except StopIteration:
            raise ValueError("El archivo Excel está vacío.")
        headers = [_normalize_header(h) for h in raw_headers]
        rows = [list(r) for r in rows_iter]
        wb.close()
        return headers, rows

    if fname.endswith(".csv"):
        text = file_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(text))
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise ValueError("El archivo CSV está vacío.")
        headers = [_normalize_header(h) for h in raw_headers]
        return headers, list(reader)

    raise ValueError("Formato no soportado. Use archivos .xlsx o .csv.")


def process_price_list_import(
    user,
    file_bytes: bytes,
    filename: str,
    dry_run: bool = True,
    allow_expired: bool = False,
    idempotency_key: str = "",
) -> dict:
    """Importa o simula una lista de costos de proveedores."""
    if not (is_effective_super_admin(user) or user_has_capability(user, PERM_EDIT_COSTS)):
        raise DjangoPermissionDenied("No posee permiso ('edit_costs') para importar listas de costos.")

    headers, raw_rows = _read_tabular_file(file_bytes, filename)
    required = {"supplier_code", "sku", "unit_cost", "currency"}
    missing_cols = required - set(headers)
    if missing_cols:
        raise ValueError(f"Faltan columnas obligatorias: {', '.join(sorted(missing_cols))}.")

    def _execute():
        suppliers_by_code = {s.internal_code.upper(): s for s in Supplier.objects.all()}
        sku_regs = {
            r.sku: r
            for r in SkuRegistry.objects.select_related("product", "variant").all()
        }
        today = timezone.localdate()

        seen_pairs = {}
        report_rows = []
        counts = {"new": 0, "updated": 0, "skipped": 0, "rejected": 0}

        ctx = transaction.atomic() if not dry_run else _nullcontext()
        with ctx:
            for row_idx, raw_vals in enumerate(raw_rows, start=2):
                if all(_is_empty(v) for v in raw_vals):
                    continue

                row_dict = {}
                for col_i, h in enumerate(headers):
                    if h:
                        row_dict[h] = raw_vals[col_i] if col_i < len(raw_vals) else None

                sup_code = str(row_dict.get("supplier_code") or "").strip().upper()
                sku = str(row_dict.get("sku") or "").strip()

                try:
                    if not sup_code or not sku:
                        raise ValueError("supplier_code y sku son obligatorios.")

                    pair = (sup_code, sku)
                    if pair in seen_pairs:
                        raise ValueError(f"Par duplicado ({sup_code}, {sku}) en fila {seen_pairs[pair]}.")
                    seen_pairs[pair] = row_idx

                    supplier = suppliers_by_code.get(sup_code)
                    if supplier is None:
                        raise ValueError(f"Proveedor '{sup_code}' no existe.")
                    if not supplier.is_active:
                        raise ValueError(f"Proveedor '{sup_code}' está inactivo.")

                    reg = sku_regs.get(sku)
                    if reg is None:
                        raise ValueError(f"SKU '{sku}' no existe en SkuRegistry del catálogo.")

                    product = reg.variant.product if reg.variant_id else reg.product
                    variant = reg.variant if reg.variant_id else None

                    raw_cost = row_dict.get("unit_cost")
                    if _is_empty(raw_cost):
                        raise ValueError("unit_cost es obligatorio.")
                    try:
                        unit_cost = Decimal(str(raw_cost).strip().replace(",", "."))
                    except (InvalidOperation, ValueError):
                        raise ValueError(f"unit_cost inválido: '{raw_cost}'.")
                    if unit_cost < Decimal("0"):
                        raise ValueError("unit_cost no puede ser negativo.")

                    currency = str(row_dict.get("currency") or "").strip().upper()
                    if currency not in SUPPORTED_CURRENCIES:
                        raise ValueError(f"Moneda '{currency}' no soportada (use CLP, USD o ARS).")

                    tax_basis = str(row_dict.get("tax_basis") or ProductSupplier.TaxBasis.NET).strip().lower()
                    if tax_basis not in dict(ProductSupplier.TaxBasis.choices):
                        raise ValueError(f"tax_basis inválido '{tax_basis}' (use 'net' o 'tax_included').")

                    moq = int(row_dict["moq"]) if not _is_empty(row_dict.get("moq")) else supplier.default_min_order_qty
                    if moq < 1:
                        raise ValueError("moq debe ser >= 1.")

                    lead_time = int(row_dict["lead_time_days"]) if not _is_empty(row_dict.get("lead_time_days")) else supplier.default_lead_time_days
                    if lead_time < 0:
                        raise ValueError("lead_time_days debe ser >= 0.")

                    avail = str(row_dict.get("reported_availability") or ProductSupplier.AvailabilityStatus.UNKNOWN).strip().lower()
                    if avail not in dict(ProductSupplier.AvailabilityStatus.choices):
                        raise ValueError(f"reported_availability inválido '{avail}'.")

                    avail_qty = None
                    if not _is_empty(row_dict.get("reported_available_qty")):
                        avail_qty = int(row_dict["reported_available_qty"])
                        if avail_qty < 0:
                            raise ValueError("reported_available_qty debe ser >= 0.")

                    valid_from = _parse_date(row_dict.get("cost_valid_from"), "cost_valid_from")
                    valid_until = _parse_date(row_dict.get("cost_valid_until"), "cost_valid_until")
                    if valid_from and valid_until and valid_until < valid_from:
                        raise ValueError("cost_valid_until no puede ser anterior a cost_valid_from.")
                    if valid_until and valid_until < today and not allow_expired:
                        raise ValueError(f"Lista de costos vencida (cost_valid_until={valid_until}).")

                    supplier_sku = str(row_dict.get("supplier_sku") or "").strip()
                    notes = str(row_dict.get("commercial_notes") or "").strip()

                    existing_link = ProductSupplier.objects.filter(
                        supplier=supplier, product=product, variant=variant
                    ).first()

                    if dry_run:
                        row_status = "new" if existing_link is None else "updated"
                    else:
                        _, created = upsert_product_supplier(
                            supplier=supplier,
                            product=product,
                            variant=variant,
                            unit_cost=unit_cost,
                            currency=currency,
                            tax_basis=tax_basis,
                            supplier_sku=supplier_sku,
                            moq=moq,
                            lead_time_days=lead_time,
                            reported_availability=avail,
                            reported_available_qty=avail_qty,
                            cost_valid_from=valid_from,
                            cost_valid_until=valid_until,
                            commercial_notes=notes,
                            actor=user,
                            source=SupplierPriceHistory.Source.IMPORT,
                            history_notes=f"Importación masiva ({filename})",
                        )
                        row_status = "new" if created else "updated"

                    counts[row_status] += 1
                    report_rows.append({
                        "row": row_idx,
                        "supplier_code": sup_code,
                        "sku": sku,
                        "unit_cost": str(unit_cost),
                        "currency": currency,
                        "status": row_status,
                    })
                except (ValueError, DjangoValidationError) as exc:
                    counts["rejected"] += 1
                    report_rows.append({
                        "row": row_idx,
                        "supplier_code": sup_code,
                        "sku": sku,
                        "status": "rejected",
                        "error": str(exc),
                    })

            if not dry_run:
                record_audit_event(
                    module=MODULE_PURCHASES,
                    action="SUPPLIER_PRICE_LIST_IMPORTED",
                    event_category=CATEGORY_BULK_OPERATION,
                    resource_type="ProductSupplier",
                    resource_repr=f"Importación lista costos ({filename}): {counts['new']} nuevos, {counts['updated']} actualizados, {counts['rejected']} rechazados",
                    actor=user,
                    severity=SEVERITY_WARNING if counts["rejected"] > 0 else SEVERITY_INFO,
                    metadata={"filename": filename, "counts": counts, "total_processed": len(report_rows)},
                    mandatory=True,
                )

        return {
            "dry_run": dry_run,
            "filename": filename,
            "summary": counts,
            "total_rows": len(report_rows),
            "rows": report_rows,
            "errors": [r for r in report_rows if r["status"] == "rejected"],
        }

    if not dry_run:
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        effective_key = idempotency_key or f"proc_import:{file_hash}"
        idem_res = IdempotencyContractService.execute(
            scope="admin_import_supplier_prices",
            idempotency_key=effective_key,
            operation=_execute,
        )
        out = dict(idem_res.result)
        out["idempotent_replay"] = idem_res.replayed
        return out

    out = _execute()
    out["idempotent_replay"] = False
    return out


class _nullcontext:
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False


def export_price_lists(user, fmt: str = "xlsx", supplier_id=None) -> tuple[bytes, str, str]:
    """Exporta listas de costos de proveedores en XLSX o CSV protegido por RBAC."""
    if not (is_effective_super_admin(user) or (user_has_capability(user, PERM_EXPORT_DATA) and user_has_capability(user, PERM_VIEW_COSTS))):
        raise DjangoPermissionDenied("Requiere permisos 'export_data' y 'view_costs' para exportar listas de costos.")

    qs = ProductSupplier.objects.select_related("supplier", "product", "variant").order_by("supplier__internal_code", "product__name")
    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)

    headers = [
        "supplier_code", "supplier_name", "sku", "product_name", "supplier_sku",
        "unit_cost", "currency", "tax_basis", "moq", "lead_time_days",
        "reported_availability", "reported_available_qty", "cost_valid_from",
        "cost_valid_until", "is_preferred", "is_active", "commercial_notes",
    ]
    rows = []
    for lnk in qs:
        pname = f"{lnk.product.name} — {lnk.variant.name}" if lnk.variant_id else lnk.product.name
        rows.append([
            sanitize_csv_cell(lnk.supplier.internal_code),
            sanitize_csv_cell(lnk.supplier.trade_name or lnk.supplier.legal_name),
            sanitize_csv_cell(lnk.internal_sku),
            sanitize_csv_cell(pname),
            sanitize_csv_cell(lnk.supplier_sku),
            str(lnk.unit_cost),
            lnk.currency,
            lnk.tax_basis,
            lnk.moq,
            lnk.lead_time_days,
            lnk.reported_availability,
            lnk.reported_available_qty if lnk.reported_available_qty is not None else "",
            lnk.cost_valid_from.isoformat() if lnk.cost_valid_from else "",
            lnk.cost_valid_until.isoformat() if lnk.cost_valid_until else "",
            "si" if lnk.is_preferred else "no",
            "si" if lnk.is_active else "no",
            sanitize_csv_cell(lnk.commercial_notes),
        ])

    fmt = (fmt or "xlsx").lower()
    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        writer.writerows(rows)
        return buf.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "levelpro_supplier_price_lists.csv"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Listas de Costos"
    ws.append(headers)
    header_fill = PatternFill(start_color="0B0E14", end_color="0B0E14", fill_type="solid")
    header_font = Font(color="1AFF6E", bold=True)
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    for r in rows:
        ws.append(r)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "levelpro_supplier_price_lists.xlsx"


def build_price_list_template_bytes(fmt: str = "xlsx") -> tuple[bytes, str, str]:
    headers = [
        "supplier_code", "sku", "supplier_sku", "unit_cost", "currency",
        "tax_basis", "moq", "lead_time_days", "reported_availability",
        "reported_available_qty", "cost_valid_from", "cost_valid_until", "commercial_notes",
    ]
    sample = [
        "SUP-0001", "LPA-MIC-001", "MFG-SM58-CL", "78.50", "USD",
        "net", "5", "14", "in_stock", "25", "2026-11-01", "2027-03-31", "Precio FOB Miami",
    ]
    fmt = (fmt or "xlsx").lower()
    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        writer.writerow(sample)
        return buf.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "plantilla_costos_proveedores.csv"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Plantilla Costos"
    ws.append(headers)
    ws.append(sample)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "plantilla_costos_proveedores.xlsx"
