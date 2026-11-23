"""
LEVELPRO OS V4.0 — GATE 6: Vistas API administrativas para Cost & Pricing Intelligence
Rutas rectoras:
- /api/v1/admin/costing/landed-cost/
- /api/v1/admin/costing/landed-cost/<uuid:alloc_id>/
- /api/v1/admin/costing/landed-cost/<uuid:alloc_id>/finalize/
- /api/v1/admin/costing/layers/
- /api/v1/admin/pricing/margins/
- /api/v1/admin/pricing/simulator/
- /api/v1/admin/pricing/proposals/<uuid:proposal_id>/approve/
"""

from decimal import Decimal
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.procurement.costing_serializers import (
    CostAdjustmentEntrySerializer,
    CostConsumptionRecordSerializer,
    CostLayerSerializer,
    ExchangeRateSnapshotSerializer,
    LandedCostAllocationSerializer,
    MarginPolicySerializer,
    PricingSimulationProposalSerializer,
    SerialCostUnitSerializer,
    WeightedAverageCostStateSerializer,
)
from apps.procurement.costing_services import (
    CostingServiceError,
    approve_and_apply_pricing_proposal,
    calculate_profitability_metrics,
    compute_landed_cost_distribution,
    create_or_simulate_landed_cost_allocation,
    finalize_landed_cost_allocation,
    resolve_effective_margin_policy,
    simulate_pricing_scenario,
)
from apps.procurement.models import (
    CostAdjustmentEntry,
    CostConsumptionRecord,
    CostLayer,
    ExchangeRateSnapshot,
    GoodsReceipt,
    LandedCostAllocation,
    MarginPolicy,
    PricingSimulationProposal,
    PurchaseOrder,
    SerialCostUnit,
    WeightedAverageCostState,
)
from apps.products.models import Brand, Category, Product, ProductVariant
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.audit.constants import CATEGORY_CONFIG_CHANGE, SEVERITY_INFO
from core.audit.services import record_audit_event
from core.rbac.constants import (
    MODULE_FINANCES,
    MODULE_PURCHASES,
    PERM_EDIT_COSTS,
    PERM_EDIT_PRICES,
    PERM_MANAGE_FINANCES,
    PERM_VIEW_COSTS,
    PERM_VIEW_MARGINS,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_PURCHASING,
    ROLE_SUPER_ADMIN,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability


def _can_view_costs(user) -> bool:
    return is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS)


def _can_edit_costs(user) -> bool:
    return (
        is_effective_super_admin(user)
        or user_has_capability(user, PERM_EDIT_COSTS)
        or user_has_capability(user, PERM_MANAGE_FINANCES)
    )


def _can_view_margins(user) -> bool:
    return (
        is_effective_super_admin(user)
        or user_has_capability(user, PERM_VIEW_MARGINS)
        or user_has_capability(user, PERM_VIEW_COSTS)
    )


def _can_edit_prices(user) -> bool:
    return (
        is_effective_super_admin(user)
        or user_has_capability(user, PERM_EDIT_PRICES)
        or user_has_capability(user, PERM_MANAGE_FINANCES)
    )


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_landed_cost_list(request):
    """
    GET/POST /api/v1/admin/costing/landed-cost/
    - GET: Lista asignaciones de Landed Cost con sus gastos, líneas prorrateadas y snapshots FX.
    - POST:
      - Si incluye 'synthetic_only=True' (modo calculadora matemática pura), ejecuta compute_landed_cost_distribution.
      - En modo operativo, crea y valida una LandedCostAllocation asociada a una PurchaseOrder y GoodsReceipt.
    """
    if not _can_view_costs(request.user):
        return Response(
            {"error": "Requiere permiso 'view_costs' para acceder al motor de Landed Cost."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "GET":
        qs = LandedCostAllocation.objects.select_related(
            "purchase_order",
            "purchase_order__supplier",
            "goods_receipt",
            "po_to_valuation_fx",
        ).prefetch_related(
            "expenses",
            "expenses__fx_snapshot",
            "line_allocations",
            "line_allocations__product",
            "line_allocations__variant",
            "line_allocations__cost_layer",
        )
        po_id = (request.query_params.get("purchase_order") or "").strip()
        if po_id:
            qs = qs.filter(purchase_order_id=po_id)
        gr_id = (request.query_params.get("goods_receipt") or "").strip()
        if gr_id:
            qs = qs.filter(goods_receipt_id=gr_id)
        st = (request.query_params.get("status") or "").strip()
        if st:
            qs = qs.filter(status=st)
        data = LandedCostAllocationSerializer(qs[:200], many=True).data
        return Response({"results": data, "count": len(data)})

    if not _can_edit_costs(request.user):
        return Response(
            {"error": "Requiere permiso 'edit_costs' o 'manage_finances' para calcular o registrar Landed Cost."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        if request.data.get("synthetic_only"):
            dist = compute_landed_cost_distribution(
                lines=request.data.get("lines") or [],
                expenses=request.data.get("expenses") or [],
            )
            return Response({
                "rounding_policy": dist["rounding_policy"],
                "total_cif_base": str(dist["total_cif_base"]),
                "total_capitalizable_expenses": str(dist["total_capitalizable_expenses"]),
                "total_non_capitalizable_taxes": str(dist["total_non_capitalizable_taxes"]),
                "total_landed_cost": str(dist["total_landed_cost"]),
                "lines": [
                    {
                        **ln,
                        "cif_base_unit": str(ln["cif_base_unit"]),
                        "cif_base_total": str(ln["cif_base_total"]),
                        "unit_weight": str(ln["unit_weight"]) if ln["unit_weight"] is not None else None,
                        "total_weight": str(ln["total_weight"]) if ln["total_weight"] is not None else None,
                        "allocated_expenses_total": str(ln["allocated_expenses_total"]),
                        "allocated_expense_unit": str(ln["allocated_expense_unit"]),
                        "rounding_adjustment": str(ln["rounding_adjustment"]),
                        "landed_total_cost": str(ln["landed_total_cost"]),
                        "landed_unit_cost": str(ln["landed_unit_cost"]),
                    }
                    for ln in dist["lines"]
                ],
                "expenses_audit": dist["expenses_audit"],
            })

        po_id = request.data.get("purchase_order_id") or request.data.get("purchase_order")
        po = PurchaseOrder.objects.get(pk=po_id)
        gr_id = request.data.get("goods_receipt_id") or request.data.get("goods_receipt")
        gr = GoodsReceipt.objects.get(pk=gr_id) if gr_id else None

        alloc = create_or_simulate_landed_cost_allocation(
            purchase_order=po,
            goods_receipt=gr,
            expenses=request.data.get("expenses") or [],
            valuation_currency=request.data.get("valuation_currency") or po.currency,
            po_fx_payload=request.data.get("po_fx") or None,
            line_weights_override=request.data.get("line_weights_override") or None,
            is_late_adjustment=bool(request.data.get("is_late_adjustment", False)),
            notes=request.data.get("notes") or "",
            actor=request.user,
        )
        if request.data.get("finalize"):
            idem = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key") or None
            alloc = finalize_landed_cost_allocation(alloc, idempotency_key=idem, actor=request.user)
        return Response(LandedCostAllocationSerializer(alloc).data, status=status.HTTP_201_CREATED)
    except (PurchaseOrder.DoesNotExist, GoodsReceipt.DoesNotExist):
        return Response({"error": "Orden de compra o recepción no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except (CostingServiceError, ValueError, KeyError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
    },
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_landed_cost_detail(request, alloc_id):
    if not _can_view_costs(request.user):
        return Response({"error": "Requiere permiso 'view_costs'."}, status=status.HTTP_403_FORBIDDEN)
    try:
        alloc = LandedCostAllocation.objects.select_related(
            "purchase_order", "purchase_order__supplier", "goods_receipt", "po_to_valuation_fx"
        ).prefetch_related("expenses", "line_allocations").get(pk=alloc_id)
        return Response(LandedCostAllocationSerializer(alloc).data)
    except LandedCostAllocation.DoesNotExist:
        return Response({"error": "Asignación de Landed Cost no encontrada."}, status=status.HTTP_404_NOT_FOUND)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
    },
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_landed_cost_finalize(request, alloc_id):
    """POST /api/v1/admin/costing/landed-cost/<alloc_id>/finalize/"""
    if not _can_edit_costs(request.user):
        return Response(
            {"error": "Requiere permiso 'edit_costs' o 'manage_finances' para finalizar Landed Cost."},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        alloc = LandedCostAllocation.objects.get(pk=alloc_id)
        idem = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key") or None
        alloc = finalize_landed_cost_allocation(alloc, idempotency_key=idem, actor=request.user)
        return Response(LandedCostAllocationSerializer(alloc).data)
    except LandedCostAllocation.DoesNotExist:
        return Response({"error": "Asignación de Landed Cost no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except CostingServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
    },
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_cost_layers_list(request):
    """
    GET /api/v1/admin/costing/layers/
    Retorna:
    - Capas históricas de costo (CostLayer)
    - Costeo por número de serie (SerialCostUnit)
    - Estados de promedio ponderado móvil (WeightedAverageCostState)
    - Consumos históricos de costo (CostConsumptionRecord)
    - Ajustes tardíos versionados (CostAdjustmentEntry)
    - Historial de tipos de cambio congelados (ExchangeRateSnapshot)
    """
    if not _can_view_costs(request.user):
        return Response(
            {"error": "Requiere permiso 'view_costs' para consultar capas de costo y seriales valorizados."},
            status=status.HTTP_403_FORBIDDEN,
        )

    layers_qs = CostLayer.objects.select_related(
        "product", "product__brand", "variant", "supplier", "warehouse", "purchase_order", "goods_receipt", "fx_snapshot"
    ).order_by("-effective_date", "-created_at")
    serials_qs = SerialCostUnit.objects.select_related(
        "serial_track", "serial_track__warehouse", "product", "variant", "cost_layer", "purchase_order", "goods_receipt"
    ).order_by("-created_at")
    wac_qs = WeightedAverageCostState.objects.select_related("product", "product__brand", "variant").order_by("sku_snapshot")
    consumptions_qs = CostConsumptionRecord.objects.select_related(
        "product", "warehouse", "cost_layer"
    ).order_by("-recorded_at")
    adjustments_qs = CostAdjustmentEntry.objects.select_related("cost_layer", "allocation").order_by("-recorded_at")
    fx_qs = ExchangeRateSnapshot.objects.select_related("created_by").order_by("-effective_date", "-created_at")

    sku = (request.query_params.get("sku") or "").strip()
    if sku:
        layers_qs = layers_qs.filter(sku_snapshot__icontains=sku)
        serials_qs = serials_qs.filter(serial_number_snapshot__icontains=sku) | serials_qs.filter(
            cost_layer__sku_snapshot__icontains=sku
        )
        wac_qs = wac_qs.filter(sku_snapshot__icontains=sku)

    currency = (request.query_params.get("currency") or "").strip().upper()
    if currency:
        layers_qs = layers_qs.filter(valuation_currency=currency)
        serials_qs = serials_qs.filter(valuation_currency=currency)
        wac_qs = wac_qs.filter(currency=currency)

    return Response({
        "layers": CostLayerSerializer(layers_qs[:200], many=True).data,
        "serial_costs": SerialCostUnitSerializer(serials_qs[:200], many=True).data,
        "weighted_averages": WeightedAverageCostStateSerializer(wac_qs[:200], many=True).data,
        "consumptions": CostConsumptionRecordSerializer(consumptions_qs[:100], many=True).data,
        "adjustments": CostAdjustmentEntrySerializer(adjustments_qs[:100], many=True).data,
        "fx_snapshots": ExchangeRateSnapshotSerializer(fx_qs[:100], many=True).data,
    })


@rbac_endpoint(
    module=MODULE_FINANCES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_pricing_margins_view(request):
    """
    GET/POST /api/v1/admin/pricing/margins/
    - GET: Reporte ejecutivo de rentabilidad por SKU, reporte consolidado por marca/categoría,
      alertas de margen mínimo de seguridad y políticas de margen configuradas.
    - POST: Crea o actualiza una política de margen mínimo/objetivo (requiere edit_prices / manage_finances).
    """
    if not _can_view_margins(request.user):
        return Response(
            {"error": "Requiere permiso 'view_margins' o 'view_costs' para consultar rentabilidad."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "POST":
        if not _can_edit_prices(request.user):
            return Response(
                {"error": "Requiere permiso 'edit_prices' o 'manage_finances' para modificar políticas de margen."},
                status=status.HTTP_403_FORBIDDEN,
            )
        name = (request.data.get("name") or "Política de Margen").strip()
        min_m = Decimal(str(request.data.get("min_margin_percent") or "20.00"))
        target_m = Decimal(str(request.data.get("target_margin_percent") or "35.00"))
        if min_m < Decimal("0") or target_m < min_m or target_m >= Decimal("100"):
            return Response(
                {"error": "Los porcentajes de margen deben cumplir 0 <= min_margin <= target_margin < 100."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        brand = Brand.objects.filter(pk=request.data.get("brand_id")).first() if request.data.get("brand_id") else None
        cat = Category.objects.filter(pk=request.data.get("category_id")).first() if request.data.get("category_id") else None
        prod = Product.objects.filter(pk=request.data.get("product_id")).first() if request.data.get("product_id") else None

        policy = MarginPolicy.objects.create(
            name=name[:120],
            brand=brand,
            category=cat,
            product=prod,
            min_margin_percent=min_m,
            target_margin_percent=target_m,
            is_active=True,
            updated_by=request.user,
        )
        record_audit_event(
            module=MODULE_FINANCES,
            action="MARGIN_POLICY_CREATED",
            event_category=CATEGORY_CONFIG_CHANGE,
            resource_type="MarginPolicy",
            resource_id=str(policy.id),
            resource_repr=policy.name,
            new_values={
                "min_margin_percent": str(min_m),
                "target_margin_percent": str(target_m),
                "brand": brand.name if brand else None,
            },
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
        return Response(MarginPolicySerializer(policy).data, status=status.HTTP_201_CREATED)

    target_currency = (request.query_params.get("currency") or "").strip().upper()
    sku_margins = []
    alerts = []
    brand_buckets = {}

    wac_map = {}
    for w in WeightedAverageCostState.objects.select_related("product", "product__brand", "product__category", "variant").all():
        key = (w.product_id, w.variant_id, w.currency)
        wac_map[key] = w

    latest_layers = {}
    for lyr in CostLayer.objects.select_related("product", "product__brand", "product__category", "variant", "supplier").order_by("effective_date", "created_at"):
        key = (lyr.product_id, lyr.variant_id, lyr.valuation_currency)
        latest_layers[key] = lyr

    products = Product.objects.select_related("brand", "category").prefetch_related("variants").filter(is_active=True)[:200]

    for prod in products:
        min_m, target_m = resolve_effective_margin_policy(prod)
        units = list(prod.variants.filter(is_active=True)) or [None]
        for var in units:
            sku_code = var.sku if var else (prod.sku or "")
            unit_label = f"{prod.name} — {var.name}" if var else prod.name
            brand_name = prod.brand.name if prod.brand_id and prod.brand else "Sin Marca"
            cat_name = prod.category.name if prod.category_id and prod.category else "Sin Categoría"

            # Evaluar en las monedas donde exista costo o en la moneda solicitada
            candidate_currencies = [target_currency] if target_currency else ["CLP", "USD", "ARS"]
            matched_any = False

            for curr in candidate_currencies:
                wac = wac_map.get((prod.id, var.id if var else None, curr))
                lyr = latest_layers.get((prod.id, var.id if var else None, curr))
                u_cost = None
                cost_source = None
                if wac and wac.average_unit_cost > Decimal("0"):
                    u_cost = wac.average_unit_cost
                    cost_source = "weighted_average"
                elif lyr:
                    u_cost = lyr.landed_unit_cost
                    cost_source = lyr.costing_method
                elif curr == "CLP":
                    cat_c = var.effective_cost_price if var else prod.cost_price
                    if cat_c is not None and cat_c > Decimal("0"):
                        u_cost = Decimal(str(cat_c))
                        cost_source = "catalog_cost_price"

                if u_cost is None:
                    continue

                matched_any = True
                if curr == "CLP":
                    sale_p = var.effective_price if var else prod.price
                elif curr == "USD":
                    sale_p = var.price_usd if (var and var.price_usd is not None) else prod.price_usd
                else:
                    sale_p = var.price_ars if (var and var.price_ars is not None) else prod.price_ars

                metrics = calculate_profitability_metrics(
                    sale_price=sale_p,
                    sale_currency=curr,
                    unit_cost=u_cost,
                    cost_currency=curr,
                    price_tax_basis="net",
                    min_margin_percent=min_m,
                )

                entry = {
                    "product_id": str(prod.id),
                    "variant_id": str(var.id) if var else None,
                    "sku": sku_code,
                    "name": unit_label,
                    "brand_name": brand_name,
                    "category_name": cat_name,
                    "currency": curr,
                    "cost_source": cost_source,
                    "unit_cost": str(u_cost),
                    "sale_price": str(sale_p) if sale_p is not None else None,
                    "status": metrics["status"],
                    "reason": metrics["reason"],
                    "gross_margin_unit": str(metrics["gross_margin_unit"]) if metrics["gross_margin_unit"] is not None else None,
                    "margin_on_sales_percent": str(metrics["margin_on_sales_percent"]) if metrics["margin_on_sales_percent"] is not None else None,
                    "markup_on_cost_percent": str(metrics["markup_on_cost_percent"]) if metrics["markup_on_cost_percent"] is not None else None,
                    "min_margin_threshold_percent": str(min_m),
                    "target_margin_percent": str(target_m),
                    "below_min_margin": metrics["below_min_margin"],
                }
                sku_margins.append(entry)

                if metrics["below_min_margin"]:
                    alerts.append(entry)

                if metrics["status"] == "calculated" and metrics["margin_on_sales_percent"] is not None:
                    b_key = f"{brand_name}::{curr}"
                    if b_key not in brand_buckets:
                        brand_buckets[b_key] = {
                            "brand_name": brand_name,
                            "currency": curr,
                            "sku_count": 0,
                            "alerts_count": 0,
                            "sum_margin_percent": Decimal("0.00"),
                            "sum_markup_percent": Decimal("0.00"),
                        }
                    brand_buckets[b_key]["sku_count"] += 1
                    if metrics["below_min_margin"]:
                        brand_buckets[b_key]["alerts_count"] += 1
                    brand_buckets[b_key]["sum_margin_percent"] += metrics["margin_on_sales_percent"]
                    if metrics["markup_on_cost_percent"] is not None:
                        brand_buckets[b_key]["sum_markup_percent"] += metrics["markup_on_cost_percent"]

            if not matched_any and (not target_currency or target_currency == "CLP"):
                sale_p = var.effective_price if var else prod.price
                sku_margins.append({
                    "product_id": str(prod.id),
                    "variant_id": str(var.id) if var else None,
                    "sku": sku_code,
                    "name": unit_label,
                    "brand_name": brand_name,
                    "category_name": cat_name,
                    "currency": "CLP",
                    "cost_source": None,
                    "unit_cost": None,
                    "sale_price": str(sale_p) if sale_p is not None else None,
                    "status": "pending_calculation",
                    "reason": "missing_verified_cost",
                    "gross_margin_unit": None,
                    "margin_on_sales_percent": None,
                    "markup_on_cost_percent": None,
                    "min_margin_threshold_percent": str(min_m),
                    "target_margin_percent": str(target_m),
                    "below_min_margin": False,
                })

    brand_reports = []
    for b in brand_buckets.values():
        cnt = max(1, b["sku_count"])
        brand_reports.append({
            "brand_name": b["brand_name"],
            "currency": b["currency"],
            "sku_count": b["sku_count"],
            "alerts_count": b["alerts_count"],
            "avg_margin_on_sales_percent": str((b["sum_margin_percent"] / Decimal(cnt)).quantize(Decimal("0.01"))),
            "avg_markup_on_cost_percent": str((b["sum_markup_percent"] / Decimal(cnt)).quantize(Decimal("0.01"))),
        })

    policies = MarginPolicy.objects.select_related("brand", "category", "product").filter(is_active=True)[:100]

    return Response({
        "sku_margins": sku_margins,
        "brand_reports": brand_reports,
        "margin_alerts": alerts,
        "policies": MarginPolicySerializer(policies, many=True).data,
    })


@rbac_endpoint(
    module=MODULE_FINANCES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_pricing_simulator_view(request):
    """
    GET/POST /api/v1/admin/pricing/simulator/
    - GET: Lista propuestas comerciales simuladas (PricingSimulationProposal).
    - POST: Ejecuta simulación de precios/escenarios FX sin alterar automáticamente el catálogo.
    """
    if not _can_view_margins(request.user):
        return Response(
            {"error": "Requiere permiso 'view_margins' o 'view_costs' para utilizar el simulador."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "GET":
        qs = PricingSimulationProposal.objects.select_related("product", "variant").order_by("-created_at")[:100]
        return Response({"results": PricingSimulationProposalSerializer(qs, many=True).data})

    try:
        prod = Product.objects.get(pk=request.data.get("product_id") or request.data.get("product"))
        var_id = request.data.get("variant_id") or request.data.get("variant")
        var = ProductVariant.objects.get(pk=var_id, product=prod) if var_id else None
        res = simulate_pricing_scenario(
            product=prod,
            variant=var,
            currency=request.data.get("currency") or "CLP",
            base_landed_cost=request.data.get("base_landed_cost"),
            cost_currency=request.data.get("cost_currency"),
            fx_scenario_rate=request.data.get("fx_scenario_rate"),
            proposed_net_price=request.data.get("proposed_net_price"),
            target_margin_percent=request.data.get("target_margin_percent"),
            tax_rate_percent=request.data.get("tax_rate_percent"),
            save_proposal=bool(request.data.get("save_proposal", False)),
            notes=request.data.get("notes") or "",
            actor=request.user,
        )
        return Response(res, status=status.HTTP_201_CREATED if request.data.get("save_proposal") else status.HTTP_200_OK)
    except (Product.DoesNotExist, ProductVariant.DoesNotExist):
        return Response({"error": "Producto o variante no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    except (CostingServiceError, ValueError, KeyError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_FINANCES,
    allowed_roles_by_method={
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
    },
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_pricing_proposal_approve(request, proposal_id):
    """POST /api/v1/admin/pricing/proposals/<proposal_id>/approve/"""
    if not _can_edit_prices(request.user):
        return Response(
            {"error": "Requiere permiso 'edit_prices' para confirmar y aplicar propuestas al catálogo."},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        prop = PricingSimulationProposal.objects.get(pk=proposal_id)
        prop = approve_and_apply_pricing_proposal(prop, actor=request.user)
        return Response(PricingSimulationProposalSerializer(prop).data)
    except PricingSimulationProposal.DoesNotExist:
        return Response({"error": "Propuesta no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except CostingServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
