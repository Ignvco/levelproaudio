"""
apps/rewards/selectors.py — funciones de lectura desacopladas.
"""
from django.utils import timezone
from django.db.models import Q, Count

from .models import Campaign, RewardProduct, Entry, CampaignStatus


def get_active_campaigns():
    """Campañas activas con fecha vigente."""
    now = timezone.now()
    return Campaign.objects.filter(
        status=CampaignStatus.ACTIVE,
        start_date__lte=now,
        end_date__gte=now,
    ).order_by("draw_date")


def get_current_campaign():
    """Devuelve la campaña activa más próxima a cerrar (o None)."""
    return get_active_campaigns().first()


def get_products_in_active_campaigns():
    """Products que participan en al menos una campaña activa."""
    active_ids = get_active_campaigns().values_list("id", flat=True)
    return RewardProduct.objects.filter(
        campaign_id__in=active_ids, is_active=True
    ).select_related("campaign", "product")


def get_product_participation(product):
    """Para un product dado, devuelve las campañas activas en las que participa
    junto con las entries_per_purchase de cada una."""
    return RewardProduct.objects.filter(
        product=product,
        is_active=True,
        campaign__status=CampaignStatus.ACTIVE,
        campaign__start_date__lte=timezone.now(),
        campaign__end_date__gte=timezone.now(),
    ).select_related("campaign")


def get_entries_preview_for_cart(cart_items):
    """
    Calcula cuántas entries totales generaría la compra del carrito actual
    agrupadas por campaña. Devuelve lista [{campaign, entries_count}].

    cart_items: iterable de dicts con {product_id, quantity} o items del cart.
    """
    from collections import defaultdict
    by_campaign = defaultdict(int)

    product_ids = [it["product_id"] if isinstance(it, dict) else it.product.id
                   for it in cart_items]

    rps = RewardProduct.objects.filter(
        product_id__in=product_ids,
        is_active=True,
        campaign__status=CampaignStatus.ACTIVE,
        campaign__start_date__lte=timezone.now(),
        campaign__end_date__gte=timezone.now(),
    ).select_related("campaign", "product")

    qty_by_product = {}
    for it in cart_items:
        if isinstance(it, dict):
            qty_by_product[it["product_id"]] = it["quantity"]
        else:
            qty_by_product[str(it.product.id)] = it.quantity

    for rp in rps:
        qty = qty_by_product.get(str(rp.product_id), 0)
        if qty <= 0:
            continue
        by_campaign[rp.campaign] += rp.entries_per_purchase * qty

    return [{"campaign": c, "entries_count": n} for c, n in by_campaign.items()]


def get_user_entries_grouped(user):
    """
    Entries del usuario agrupadas por campaña.
    Devuelve queryset annotated con conteos.
    """
    return (
        Campaign.objects
        .filter(entries__user=user)
        .annotate(user_entries_count=Count("entries", filter=Q(entries__user=user)))
        .distinct()
        .order_by("-draw_date")
    )
