# apps/products/pim_io.py
"""
LEVELPRO OS V4.0 — GATE 2 (BF-16)
Importador y Exportador profesional Excel (.xlsx) y CSV (.csv) para PIM:
- Plantillas descargables (.xlsx / .csv)
- Dry-run (simulación) y confirmación explícita
- Clasificación por fila: new, updated, skipped, rejected
- Detección de duplicados en archivo y colisión de SKUs
- Distinción estricta entre celda vacía (no sobrescribe), cero (0), y __CLEAR__
- No sobrescribe columnas ausentes
- Aislamiento CLP / USD / ARS con Decimal
- Prevención de Formula Injection (=, +, -, @, \t, \r) en exportaciones
- RBAC en exportación (cost_price solo con PERM_VIEW_COSTS)
- Idempotencia y Audit Trail
"""

import csv
import hashlib
import io
import re
from decimal import Decimal, InvalidOperation
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from django.db import transaction, IntegrityError
from django.utils.text import slugify
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError

from apps.products.models import (
    Product,
    ProductVariant,
    Category,
    Brand,
    TechnicalAttributeDefinition,
    ProductTechnicalSpec,
)
from apps.products.specs_catalog import validate_and_normalize_spec_value
from core.contracts.idempotency import IdempotencyContractService
from core.contracts.money import Money
from core.rbac.constants import (
    MODULE_CATALOG,
    PERM_VIEW_COSTS,
    PERM_EDIT_COSTS,
    PERM_EDIT_PRICES,
    PERM_ADJUST_INVENTORY,
    PERM_EXPORT_DATA,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability
from core.audit.services import record_audit_event
from core.audit.constants import (
    CATEGORY_BULK_OPERATION,
    CATEGORY_EXPORT,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)

MAX_IMPORT_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_IMPORT_ROWS = 5000
CLEAR_TOKENS = {"__CLEAR__", "__DELETE__"}
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_formula_cell(value):
    """Previene CSV/Excel Formula Injection prefijando celdas peligrosas con comilla simple."""
    if value is None:
        return ""
    s = str(value)
    if s and s[0] in FORMULA_PREFIXES:
        return "'" + s
    return s


def _normalize_header(h) -> str:
    if h is None:
        return ""
    s = str(h).strip().lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n")):
        s = s.replace(a, b)
    s = s.replace(" ", "_")
    return s


HEADER_ALIASES = {
    "sku": "sku",
    "parent_sku": "parent_sku",
    "sku_maestro": "parent_sku",
    "nombre": "name",
    "name": "name",
    "nombre_variante": "variant_name",
    "variant_name": "variant_name",
    "barcode": "barcode",
    "codigo_barras": "barcode",
    "ean": "barcode",
    "categoria": "category",
    "category": "category",
    "marca": "brand",
    "brand": "brand",
    "tipo": "product_type",
    "product_type": "product_type",
    "precio": "price",
    "precio_clp": "price",
    "price": "price",
    "price_clp": "price",
    "precio_comparacion": "compare_price",
    "compare_price": "compare_price",
    "precio_usd": "price_usd",
    "price_usd": "price_usd",
    "precio_ars": "price_ars",
    "price_ars": "price_ars",
    "costo": "cost_price",
    "precio_costo": "cost_price",
    "cost_price": "cost_price",
    "stock": "stock",
    "stock_min": "stock_min",
    "stock_minimo": "stock_min",
    "peso": "weight",
    "weight": "weight",
    "activo": "is_active",
    "is_active": "is_active",
    "destacado": "is_featured",
    "is_featured": "is_featured",
    "descripcion_corta": "short_description",
    "short_description": "short_description",
    "descripcion": "description",
    "description": "description",
    "seo_titulo": "seo_title",
    "seo_title": "seo_title",
    "seo_descripcion": "seo_description",
    "seo_description": "seo_description",
    "impedancia_variante": "attr_impedance",
    "variant_impedance": "attr_impedance",
    "color_variante": "attr_color",
    "variant_color": "attr_color",
    "conexion_variante": "attr_connection",
    "variant_connection": "attr_connection",
    "tamano_variante": "attr_size",
    "variant_size": "attr_size",
    "configuracion_variante": "attr_configuration",
    "variant_configuration": "attr_configuration",
}

CLEARABLE_PRODUCT_FIELDS = {
    "compare_price", "price_usd", "price_ars", "cost_price",
    "short_description", "description", "seo_title", "seo_description", "weight",
}
CLEARABLE_VARIANT_FIELDS = {
    "price", "compare_price", "price_usd", "price_ars", "cost_price", "barcode", "weight",
}


def _is_empty(val) -> bool:
    return val is None or (isinstance(val, str) and val.strip() == "")


def _is_clear(val) -> bool:
    return isinstance(val, str) and val.strip().upper() in CLEAR_TOKENS


def _parse_decimal(val, field_label: str, currency: str = None) -> Decimal:
    if isinstance(val, bool):
        raise ValueError(f"{field_label}: valor booleano inválido para monto.")
    s = str(val).strip().replace(" ", "")
    if not s:
        raise ValueError(f"{field_label}: valor vacío.")
    # Permitir formato 1234.56 o 1234,56
    if "," in s and "." not in s:
        s = s.replace(",", ".")
    elif "," in s and "." in s:
        s = s.replace(",", "")
    try:
        dec = Decimal(s)
    except InvalidOperation:
        raise ValueError(f"{field_label}: '{val}' no es un decimal válido.")
    if dec < Decimal("0"):
        raise ValueError(f"{field_label}: no puede ser negativo ({dec}).")
    if currency:
        Money(dec, currency)
    return dec


def _parse_int(val, field_label: str) -> int:
    if isinstance(val, bool):
        raise ValueError(f"{field_label}: valor inválido.")
    try:
        dec = Decimal(str(val).strip())
        if dec != dec.to_integral_value():
            raise ValueError(f"{field_label}: debe ser un entero.")
        iv = int(dec)
    except (InvalidOperation, ValueError):
        raise ValueError(f"{field_label}: '{val}' no es un entero válido.")
    if iv < 0:
        raise ValueError(f"{field_label}: no puede ser negativo ({iv}).")
    return iv


def _parse_bool(val, field_label: str) -> bool:
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    if s in ("true", "1", "si", "sí", "yes", "x"):
        return True
    if s in ("false", "0", "no"):
        return False
    raise ValueError(f"{field_label}: '{val}' no es booleano válido (si/no/true/false/1/0).")


def _read_tabular_file(file_bytes: bytes, filename: str):
    if len(file_bytes) > MAX_IMPORT_BYTES:
        raise ValueError(f"El archivo excede el límite máximo de {MAX_IMPORT_BYTES // (1024 * 1024)} MB.")

    lower = (filename or "").lower()
    rows = []
    if lower.endswith(".csv"):
        try:
            text = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
        reader = csv.reader(io.StringIO(text))
        all_rows = list(reader)
        if not all_rows:
            raise ValueError("El archivo CSV está vacío.")
        raw_headers = all_rows[0]
        data_rows = all_rows[1:]
    elif lower.endswith(".xlsx") or lower.endswith(".xls"):
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)
        ws = wb.active
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            raise ValueError("La hoja Excel está vacía.")
        raw_headers = list(all_rows[0])
        data_rows = [list(r) for r in all_rows[1:]]
    else:
        raise ValueError("Formato no soportado. Utiliza .xlsx o .csv.")

    if len(data_rows) > MAX_IMPORT_ROWS:
        raise ValueError(f"El archivo supera el máximo permitido de {MAX_IMPORT_ROWS} filas.")

    headers = []
    spec_columns = {}
    for idx, rh in enumerate(raw_headers):
        norm = _normalize_header(rh)
        if norm.startswith("spec:") or norm.startswith("spec_"):
            spec_key = norm.split(":", 1)[1] if ":" in norm else norm[5:]
            headers.append(f"spec:{spec_key}")
            spec_columns[idx] = spec_key
        else:
            headers.append(HEADER_ALIASES.get(norm, norm))

    return headers, data_rows


def _validate_import_permissions(user, headers):
    if is_effective_super_admin(user):
        return
    if not user_has_capability(user, PERM_EDIT_PRICES):
        raise DjangoPermissionDenied("No posee autorización ('edit_prices') para importar catálogo.")
    if "cost_price" in headers and not user_has_capability(user, PERM_EDIT_COSTS):
        raise DjangoPermissionDenied("No posee autorización ('edit_costs') para importar costos (cost_price).")
    if ("stock" in headers or "stock_min" in headers) and not user_has_capability(user, PERM_ADJUST_INVENTORY):
        raise DjangoPermissionDenied("No posee autorización ('adjust_inventory') para importar stock.")


def process_pim_import(user, file_bytes: bytes, filename: str, dry_run: bool = True, idempotency_key: str = "") -> dict:
    """
    Procesa importación CSV/Excel en modo dry_run o aplicación real.
    Clasifica cada fila en: new, updated, skipped, rejected.
    """
    headers, raw_rows = _read_tabular_file(file_bytes, filename)
    _validate_import_permissions(user, headers)

    if "sku" not in headers and "name" not in headers:
        raise ValueError("El archivo debe contener al menos la columna 'sku' o 'nombre'.")

    def _execute():
        attr_defs = {a.key: a for a in TechnicalAttributeDefinition.objects.filter(is_active=True)}
        seen_skus = {}
        report_rows = []
        counts = {"new": 0, "updated": 0, "skipped": 0, "rejected": 0}

        # Cargar referencias existentes
        existing_products_by_sku = {
            p.sku: p for p in Product.objects.exclude(sku__isnull=True).exclude(sku="")
        }
        existing_variants_by_sku = {
            v.sku: v for v in ProductVariant.objects.select_related("product").all()
        }
        # Cache local para variantes cuyo padre se crea en el mismo archivo
        staged_products_by_sku = dict(existing_products_by_sku)

        ctx = transaction.atomic() if not dry_run else _nullcontext()
        with ctx:
            for row_idx, raw_vals in enumerate(raw_rows, start=2):
                # Saltar filas completamente vacías
                if all(_is_empty(v) for v in raw_vals):
                    continue

                row_dict = {}
                spec_inputs = {}
                for col_i, h in enumerate(headers):
                    val = raw_vals[col_i] if col_i < len(raw_vals) else None
                    if h.startswith("spec:"):
                        spec_key = h.split(":", 1)[1]
                        if not _is_empty(val):
                            spec_inputs[spec_key] = val
                    elif h:
                        row_dict[h] = val

                sku = str(row_dict.get("sku")).strip() if not _is_empty(row_dict.get("sku")) else ""
                parent_sku = str(row_dict.get("parent_sku")).strip() if not _is_empty(row_dict.get("parent_sku")) else ""
                name = str(row_dict.get("name")).strip() if not _is_empty(row_dict.get("name")) else ""

                row_label = sku or name or f"Fila {row_idx}"

                # Detección de duplicados dentro del archivo
                if sku:
                    if sku in seen_skus:
                        counts["rejected"] += 1
                        report_rows.append({
                            "row": row_idx,
                            "sku": sku,
                            "name": name or sku,
                            "status": "rejected",
                            "entity": "variant" if parent_sku else "product",
                            "error": f"SKU '{sku}' duplicado en el archivo (ya apareció en fila {seen_skus[sku]}).",
                        })
                        continue
                    seen_skus[sku] = row_idx

                is_variant_row = bool(parent_sku) or (sku and sku in existing_variants_by_sku)

                try:
                    if is_variant_row:
                        res = _process_variant_row(
                            row_idx=row_idx,
                            row_dict=row_dict,
                            sku=sku,
                            parent_sku=parent_sku,
                            existing_variants=existing_variants_by_sku,
                            products_by_sku=staged_products_by_sku,
                            dry_run=dry_run,
                            user=user,
                        )
                    else:
                        res = _process_product_row(
                            row_idx=row_idx,
                            row_dict=row_dict,
                            spec_inputs=spec_inputs,
                            attr_defs=attr_defs,
                            sku=sku,
                            existing_products=staged_products_by_sku,
                            existing_variants=existing_variants_by_sku,
                            dry_run=dry_run,
                            user=user,
                        )
                    counts[res["status"]] += 1
                    report_rows.append(res)
                except ValueError as exc:
                    counts["rejected"] += 1
                    report_rows.append({
                        "row": row_idx,
                        "sku": sku,
                        "name": row_label,
                        "status": "rejected",
                        "entity": "variant" if is_variant_row else "product",
                        "error": str(exc),
                    })

            if not dry_run:
                record_audit_event(
                    module=MODULE_CATALOG,
                    action="BULK_PRODUCTS_IMPORTED",
                    event_category=CATEGORY_BULK_OPERATION,
                    resource_type="Product",
                    resource_repr=f"Importación PIM ({filename}): {counts['new']} nuevos, {counts['updated']} actualizados, {counts['rejected']} rechazados",
                    actor=user,
                    severity=SEVERITY_WARNING if counts["rejected"] > 0 else SEVERITY_INFO,
                    metadata={
                        "filename": filename,
                        "counts": counts,
                        "total_processed": len(report_rows),
                    },
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
        effective_key = idempotency_key or f"import:{file_hash}"
        idem_res = IdempotencyContractService.execute(
            scope="admin_import_products",
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


def _process_product_row(row_idx, row_dict, spec_inputs, attr_defs, sku, existing_products, existing_variants, dry_run, user=None):
    if sku and sku in existing_variants:
        raise ValueError(f"El SKU '{sku}' pertenece a una variante existente. Especifica 'parent_sku' para actualizarla.")

    product = existing_products.get(sku) if sku else None
    if product is None and not sku and not _is_empty(row_dict.get("name")):
        # Compatibilidad: buscar por slug si no tiene SKU
        slug_cand = slugify(str(row_dict["name"]).strip())
        product = Product.objects.filter(slug=slug_cand).first()

    is_new = product is None
    if is_new:
        if _is_empty(row_dict.get("name")):
            raise ValueError("Nombre es obligatorio para crear un producto nuevo.")
        if _is_empty(row_dict.get("price")):
            raise ValueError("Precio CLP es obligatorio para crear un producto nuevo.")

    changes = {}
    if not is_new:
        target = product
    else:
        target = Product()

    # Validar campos presentes sin sobrescribir por columnas ausentes o vacías
    if "name" in row_dict:
        raw = row_dict["name"]
        if _is_clear(raw):
            raise ValueError("El campo obligatorio 'name' no puede eliminarse.")
        if not _is_empty(raw):
            val = str(raw).strip()
            if is_new or target.name != val:
                changes["name"] = val
                target.name = val

    if sku:
        if is_new or target.sku != sku:
            changes["sku"] = sku
            target.sku = sku

    # Monedas aisladas
    for field, curr in (("price", "CLP"), ("compare_price", "CLP"), ("price_usd", "USD"), ("price_ars", "ARS"), ("cost_price", "CLP")):
        if field not in row_dict:
            continue
        raw = row_dict[field]
        if _is_clear(raw):
            if field not in CLEARABLE_PRODUCT_FIELDS:
                raise ValueError(f"El campo obligatorio '{field}' no puede eliminarse.")
            if not is_new and getattr(target, field) is not None:
                changes[field] = None
                setattr(target, field, None)
        elif not _is_empty(raw):
            dec = _parse_decimal(raw, field, currency=curr)
            if is_new or getattr(target, field) != dec:
                changes[field] = str(dec)
                setattr(target, field, dec)

    # Enteros (distingue 0 de vacío)
    for field in ("stock", "stock_min"):
        if field not in row_dict:
            continue
        raw = row_dict[field]
        if _is_clear(raw):
            raise ValueError(f"El campo '{field}' no admite limpieza; usa 0.")
        if not _is_empty(raw):
            iv = _parse_int(raw, field)
            if is_new or getattr(target, field) != iv:
                changes[field] = iv
                setattr(target, field, iv)

    if "weight" in row_dict:
        raw = row_dict["weight"]
        if _is_clear(raw):
            if not is_new and target.weight is not None:
                changes["weight"] = None
                target.weight = None
        elif not _is_empty(raw):
            dec = _parse_decimal(raw, "weight")
            if is_new or target.weight != dec:
                changes["weight"] = str(dec)
                target.weight = dec

    for field in ("is_active", "is_featured"):
        if field not in row_dict:
            continue
        raw = row_dict[field]
        if not _is_empty(raw) and not _is_clear(raw):
            bv = _parse_bool(raw, field)
            if is_new or getattr(target, field) != bv:
                changes[field] = bv
                setattr(target, field, bv)

    if "product_type" in row_dict and not _is_empty(row_dict["product_type"]):
        pt = str(row_dict["product_type"]).strip().lower()
        valid_pts = dict(Product.ProductType.choices)
        if pt not in valid_pts:
            raise ValueError(f"product_type inválido '{pt}'. Opciones: {', '.join(valid_pts.keys())}.")
        if is_new or target.product_type != pt:
            changes["product_type"] = pt
            target.product_type = pt

    for field in ("short_description", "description", "seo_title", "seo_description"):
        if field not in row_dict:
            continue
        raw = row_dict[field]
        if _is_clear(raw):
            if not is_new and getattr(target, field) != "":
                changes[field] = ""
                setattr(target, field, "")
        elif not _is_empty(raw):
            sv = str(raw).strip()
            if is_new or getattr(target, field) != sv:
                changes[field] = sv
                setattr(target, field, sv)

    if "category" in row_dict and not _is_empty(row_dict["category"]) and not _is_clear(row_dict["category"]):
        cat_name = str(row_dict["category"]).strip()
        cat = Category.objects.filter(name__iexact=cat_name).first() or Category.objects.filter(slug=slugify(cat_name)).first()
        if not dry_run and cat is None:
            cat = Category.objects.create(name=cat_name, slug=slugify(cat_name))
        if is_new or (cat and target.category_id != cat.id) or (dry_run and cat is None):
            changes["category"] = cat_name
            if cat:
                target.category = cat

    if "brand" in row_dict and not _is_empty(row_dict["brand"]) and not _is_clear(row_dict["brand"]):
        brand_name = str(row_dict["brand"]).strip()
        brand = Brand.objects.filter(name__iexact=brand_name).first() or Brand.objects.filter(slug=slugify(brand_name)).first()
        if not dry_run and brand is None:
            brand = Brand.objects.create(name=brand_name, slug=slugify(brand_name))
        if is_new or (brand and target.brand_id != brand.id) or (dry_run and brand is None):
            changes["brand"] = brand_name
            if brand:
                target.brand = brand

    # Validar especificaciones técnicas estructuradas
    validated_specs = []
    for skey, sraw in spec_inputs.items():
        adef = attr_defs.get(skey)
        if adef is None:
            raise ValueError(f"Atributo técnico desconocido 'spec:{skey}'.")
        if _is_clear(sraw):
            validated_specs.append((adef, None))
            changes[f"spec:{skey}"] = None
        else:
            vtext, vnum, vjson = validate_and_normalize_spec_value(adef, sraw)
            validated_specs.append((adef, (vtext, vnum, vjson)))
            changes[f"spec:{skey}"] = vtext

    if not is_new and not changes:
        return {
            "row": row_idx,
            "sku": sku or target.sku or "",
            "name": target.name,
            "status": "skipped",
            "entity": "product",
            "changes": {},
        }

    if not dry_run:
        if not target.slug:
            base_slug = slugify(target.name) or "producto"
            cand = base_slug
            counter = 1
            while Product.objects.filter(slug=cand).exclude(pk=target.pk).exists():
                cand = f"{base_slug}-{counter}"
                counter += 1
            target.slug = cand
        try:
            with transaction.atomic():
                from apps.inventory.services import sync_target_stock_to_wms

                if not is_new:
                    locked = Product.objects.select_for_update().get(pk=target.pk)
                    prev_stock = int(locked.stock or 0)
                    model_fields = [k for k in changes.keys() if not k.startswith("spec:") and k != "stock"]
                    for mf in model_fields:
                        setattr(locked, mf, getattr(target, mf))
                    if model_fields:
                        locked.clean()
                        locked.save(update_fields=model_fields + ["updated_at"])
                    target = locked
                    if "stock" in changes:
                        sync_target_stock_to_wms(
                            product=target,
                            variant=None,
                            target_stock=int(changes["stock"]),
                            previous_legacy_stock=prev_stock,
                            reason="Importación PIM (actualización)",
                            source_document_type="PIM_IMPORT",
                            source_document_id=str(target.pk),
                            actor=user,
                        )
                else:
                    initial_stock = int(target.stock or 0) if "stock" in changes else 0
                    target.stock = 0
                    target.clean()
                    target.save()
                    if initial_stock > 0:
                        sync_target_stock_to_wms(
                            product=target,
                            variant=None,
                            target_stock=initial_stock,
                            previous_legacy_stock=0,
                            reason="Importación PIM (creación)",
                            source_document_type="PIM_IMPORT",
                            source_document_id=str(target.pk),
                            actor=user,
                        )
        except (IntegrityError, DjangoValidationError) as exc:
            raise ValueError(f"Error de integridad/SKU al guardar producto '{sku or target.name}': {exc}") from exc
        if target.sku:
            existing_products[target.sku] = target
        for adef, val_tuple in validated_specs:
            if val_tuple is None:
                ProductTechnicalSpec.objects.filter(product=target, attribute=adef).delete()
            else:
                vtext, vnum, vjson = val_tuple
                ProductTechnicalSpec.objects.update_or_create(
                    product=target,
                    attribute=adef,
                    defaults={"value_text": vtext, "value_number": vnum, "value_json": vjson},
                )
    elif is_new and sku:
        existing_products[sku] = target

    return {
        "row": row_idx,
        "sku": sku or target.sku or "",
        "name": target.name,
        "status": "new" if is_new else "updated",
        "entity": "product",
        "changes": changes,
    }


def _process_variant_row(row_idx, row_dict, sku, parent_sku, existing_variants, products_by_sku, dry_run, user=None):
    if not sku:
        raise ValueError("Toda fila de variante requiere 'sku' único.")

    variant = existing_variants.get(sku)
    is_new = variant is None

    if is_new:
        if not parent_sku:
            raise ValueError("Para crear una variante nueva debes indicar 'parent_sku'.")
        parent = products_by_sku.get(parent_sku)
        if parent is None:
            raise ValueError(f"Producto maestro con SKU '{parent_sku}' no existe.")
        if parent.product_type == Product.ProductType.BUNDLE:
            raise ValueError("Un kit/bundle no admite variantes.")
        vname = str(row_dict.get("variant_name") or row_dict.get("name") or "").strip()
        if not vname:
            raise ValueError("variant_name (o nombre) es obligatorio para crear una variante.")
        target = ProductVariant(product=parent, sku=sku, name=vname)
    else:
        target = variant
        if parent_sku and target.product.sku != parent_sku:
            raise ValueError(f"La variante '{sku}' pertenece a '{target.product.sku}', no a '{parent_sku}'.")

    changes = {}
    vname_in = row_dict.get("variant_name") or (row_dict.get("name") if not is_new else None)
    if vname_in is not None and not _is_empty(vname_in):
        if _is_clear(vname_in):
            raise ValueError("El nombre de la variante no puede eliminarse.")
        sv = str(vname_in).strip()
        if is_new or target.name != sv:
            changes["variant_name"] = sv
            target.name = sv

    if "barcode" in row_dict:
        raw = row_dict["barcode"]
        if _is_clear(raw):
            if not is_new and target.barcode != "":
                changes["barcode"] = ""
                target.barcode = ""
        elif not _is_empty(raw):
            bv = str(raw).strip()
            if is_new or target.barcode != bv:
                changes["barcode"] = bv
                target.barcode = bv

    # Ejes de variante
    attrs = dict(target.attributes or {})
    attrs_changed = False
    for k_col, k_attr in (
        ("attr_impedance", "impedance"),
        ("attr_color", "color"),
        ("attr_connection", "connection"),
        ("attr_size", "size"),
        ("attr_configuration", "configuration"),
    ):
        if k_col in row_dict:
            raw = row_dict[k_col]
            if _is_clear(raw):
                if k_attr in attrs:
                    attrs.pop(k_attr, None)
                    attrs_changed = True
            elif not _is_empty(raw):
                sv = str(raw).strip()
                if attrs.get(k_attr) != sv:
                    attrs[k_attr] = sv
                    attrs_changed = True
    if attrs_changed:
        target.attributes = attrs
        changes["attributes"] = attrs

    for field, curr in (("price", "CLP"), ("compare_price", "CLP"), ("price_usd", "USD"), ("price_ars", "ARS"), ("cost_price", "CLP")):
        if field not in row_dict:
            continue
        raw = row_dict[field]
        if _is_clear(raw):
            if not is_new and getattr(target, field) is not None:
                changes[field] = None
                setattr(target, field, None)
        elif not _is_empty(raw):
            dec = _parse_decimal(raw, field, currency=curr)
            if is_new or getattr(target, field) != dec:
                changes[field] = str(dec)
                setattr(target, field, dec)

    for field in ("stock", "stock_min"):
        if field not in row_dict:
            continue
        raw = row_dict[field]
        if not _is_empty(raw) and not _is_clear(raw):
            iv = _parse_int(raw, field)
            if is_new or getattr(target, field) != iv:
                changes[field] = iv
                setattr(target, field, iv)

    if "is_active" in row_dict and not _is_empty(row_dict["is_active"]) and not _is_clear(row_dict["is_active"]):
        bv = _parse_bool(row_dict["is_active"], "is_active")
        if is_new or target.is_active != bv:
            changes["is_active"] = bv
            target.is_active = bv

    if not is_new and not changes:
        return {
            "row": row_idx,
            "sku": sku,
            "name": target.name,
            "status": "skipped",
            "entity": "variant",
            "changes": {},
        }

    if not dry_run:
        try:
            with transaction.atomic():
                from apps.inventory.services import sync_target_stock_to_wms

                if not is_new:
                    locked = ProductVariant.objects.select_for_update().get(pk=target.pk)
                    prev_stock = int(locked.stock or 0)
                    model_fields = [
                        ("name" if k == "variant_name" else k)
                        for k in changes.keys()
                        if k != "stock"
                    ]
                    for mf in model_fields:
                        setattr(locked, mf, getattr(target, mf))
                    if model_fields:
                        locked.clean()
                        locked.save(update_fields=model_fields + ["updated_at"])
                    target = locked
                    if "stock" in changes:
                        sync_target_stock_to_wms(
                            product=target.product,
                            variant=target,
                            target_stock=int(changes["stock"]),
                            previous_legacy_stock=prev_stock,
                            reason="Importación PIM variante (actualización)",
                            source_document_type="PIM_IMPORT",
                            source_document_id=str(target.pk),
                            actor=user,
                        )
                else:
                    initial_stock = int(target.stock or 0) if "stock" in changes else 0
                    target.stock = 0
                    target.clean()
                    target.save()
                    if initial_stock > 0:
                        sync_target_stock_to_wms(
                            product=target.product,
                            variant=target,
                            target_stock=initial_stock,
                            previous_legacy_stock=0,
                            reason="Importación PIM variante (creación)",
                            source_document_type="PIM_IMPORT",
                            source_document_id=str(target.pk),
                            actor=user,
                        )
        except (IntegrityError, DjangoValidationError) as exc:
            raise ValueError(f"Error de integridad/SKU al guardar variante '{sku}': {exc}") from exc
        existing_variants[target.sku] = target

    return {
        "row": row_idx,
        "sku": sku,
        "name": target.name,
        "status": "new" if is_new else "updated",
        "entity": "variant",
        "changes": changes,
    }


def build_pim_template_bytes(fmt: str = "xlsx") -> tuple:
    """Genera plantilla oficial descargable (.xlsx o .csv) para productos, variantes y specs."""
    headers = [
        "sku", "parent_sku", "nombre", "variant_name", "barcode",
        "categoria", "marca", "tipo",
        "precio_clp", "precio_comparacion", "precio_usd", "precio_ars", "costo",
        "stock", "stock_min", "peso", "activo", "destacado",
        "variant_impedance", "variant_color", "variant_connection",
        "spec:frequency_response", "spec:impedance_ohm", "spec:max_spl_db",
        "spec:sensitivity", "spec:connectivity",
        "descripcion_corta", "seo_titulo", "seo_descripcion",
    ]
    sample_product = [
        "LPA-MIC-001", "", "Micrófono Estudio Pro X1", "", "7801234567890",
        "Micrófonos", "LevelPro Audio", "stock",
        "149990", "179990", "158.00", "158000", "85000",
        "12", "3", "0.45", "si", "si",
        "", "", "",
        "20 Hz – 20 kHz", "150", "138",
        "-34 dBV/Pa", "XLR 3 pines balanceado",
        "Micrófono condensador cardioide de estudio.", "Micrófono Estudio Pro X1", "Condensador cardioide profesional.",
    ]
    sample_variant = [
        "LPA-MIC-001-BLK", "LPA-MIC-001", "", "Negro Mate / XLR", "7801234567891",
        "", "", "",
        "149990", "", "158.00", "", "",
        "6", "2", "", "si", "",
        "", "Negro Mate", "XLR",
        "", "", "", "", "",
        "", "", "",
    ]

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        writer.writerow(sample_product)
        writer.writerow(sample_variant)
        return buf.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "template_pim_productos.csv"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Catálogo PIM"
    ws.append(headers)
    ws.append(sample_product)
    ws.append(sample_variant)

    fill_hdr = PatternFill(start_color="0B0E14", end_color="0B0E14", fill_type="solid")
    font_hdr = Font(color="1AFF6E", bold=True, size=10)
    for c_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=c_idx)
        cell.fill = fill_hdr
        cell.font = font_hdr
        cell.alignment = Alignment(horizontal="center")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return (
        buf.getvalue(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "template_pim_productos.xlsx",
    )


def export_catalog(user, fmt: str = "xlsx", queryset=None) -> tuple:
    """
    Exporta productos y variantes a .xlsx o .csv respetando RBAC:
    - Requiere PERM_EXPORT_DATA.
    - Omite cost_price si el usuario no posee PERM_VIEW_COSTS.
    - Sanitiza todas las celdas contra Formula Injection.
    - Aísla CLP / USD / ARS en columnas explícitas.
    """
    if not is_effective_super_admin(user) and not user_has_capability(user, PERM_EXPORT_DATA):
        raise DjangoPermissionDenied("No posee autorización ('export_data') para exportar el catálogo.")

    include_costs = is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS)

    if queryset is None:
        queryset = Product.objects.select_related("category", "brand").prefetch_related(
            "variants", "technical_specs__attribute"
        ).order_by("name")

    headers = [
        "entity", "sku", "parent_sku", "name", "variant_name", "barcode",
        "category", "brand", "product_type",
        "price_clp", "compare_price_clp", "price_usd", "price_ars",
    ]
    if include_costs:
        headers.append("cost_price_clp")
    headers.extend([
        "stock", "stock_min", "weight_kg", "is_active", "is_featured",
        "variant_attributes", "technical_specs",
    ])

    rows_data = []
    exported_products = 0
    exported_variants = 0

    for p in queryset:
        exported_products += 1
        specs_str = "; ".join(
            f"{ts.attribute.key}={ts.display_value}" for ts in p.technical_specs.all()
        )
        row = [
            "product",
            sanitize_formula_cell(p.sku or ""),
            "",
            sanitize_formula_cell(p.name),
            "",
            "",
            sanitize_formula_cell(p.category.name if p.category else ""),
            sanitize_formula_cell(p.brand.name if p.brand else ""),
            sanitize_formula_cell(p.product_type),
            str(p.price),
            str(p.compare_price) if p.compare_price is not None else "",
            str(p.price_usd) if p.price_usd is not None else "",
            str(p.price_ars) if p.price_ars is not None else "",
        ]
        if include_costs:
            row.append(str(p.cost_price) if p.cost_price is not None else "")
        row.extend([
            str(p.stock),
            str(p.stock_min),
            str(p.weight) if p.weight is not None else "",
            "si" if p.is_active else "no",
            "si" if p.is_featured else "no",
            "",
            sanitize_formula_cell(specs_str),
        ])
        rows_data.append(row)

        for v in p.variants.all().order_by("order", "created_at"):
            exported_variants += 1
            v_attrs = "; ".join(f"{k}={val}" for k, val in (v.attributes or {}).items())
            vrow = [
                "variant",
                sanitize_formula_cell(v.sku),
                sanitize_formula_cell(p.sku or str(p.id)),
                sanitize_formula_cell(p.name),
                sanitize_formula_cell(v.name),
                sanitize_formula_cell(v.barcode),
                sanitize_formula_cell(p.category.name if p.category else ""),
                sanitize_formula_cell(p.brand.name if p.brand else ""),
                sanitize_formula_cell(p.product_type),
                str(v.effective_price),
                str(v.effective_compare_price) if v.effective_compare_price is not None else "",
                str(v.price_usd) if v.price_usd is not None else "",
                str(v.price_ars) if v.price_ars is not None else "",
            ]
            if include_costs:
                vrow.append(str(v.effective_cost_price) if v.effective_cost_price is not None else "")
            vrow.extend([
                str(v.stock),
                str(v.stock_min),
                str(v.effective_weight) if v.effective_weight is not None else "",
                "si" if v.is_active else "no",
                "",
                sanitize_formula_cell(v_attrs),
                "",
            ])
            rows_data.append(vrow)

    record_audit_event(
        module=MODULE_CATALOG,
        action="CATALOG_EXPORTED",
        event_category=CATEGORY_EXPORT,
        resource_type="Product",
        resource_repr=f"Exportación de catálogo ({fmt.upper()}): {exported_products} productos, {exported_variants} variantes",
        actor=user,
        severity=SEVERITY_INFO,
        metadata={
            "format": fmt,
            "include_costs": include_costs,
            "products_count": exported_products,
            "variants_count": exported_variants,
        },
        mandatory=True,
    )

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        for r in rows_data:
            writer.writerow(r)
        return buf.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "levelpro_catalogo_pim.csv"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Catálogo LevelPro"
    ws.append(headers)
    for r in rows_data:
        ws.append(r)

    fill_hdr = PatternFill(start_color="0B0E14", end_color="0B0E14", fill_type="solid")
    font_hdr = Font(color="1AFF6E", bold=True, size=10)
    for c_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=c_idx)
        cell.fill = fill_hdr
        cell.font = font_hdr

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return (
        buf.getvalue(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "levelpro_catalogo_pim.xlsx",
    )
