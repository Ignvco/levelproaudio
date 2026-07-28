"""
apps/rewards/services.py — lógica de negocio desacoplada.

- generate_entries_for_order: se invoca vía signal cuando Order.status → paid.
- run_draw:                    ejecuta el sorteo (principal + suplentes).
"""
import secrets
import string
from django.db import transaction
from django.utils import timezone

from .models import (
    Campaign,
    CampaignStatus,
    RewardProduct,
    Entry,
    Winner,
)
from .selectors import get_active_campaigns


CODE_ALPHABET = string.ascii_uppercase + string.digits


def _gen_unique_code(length: int = 8) -> str:
    """Genera un código único LPR-XXXXXXXX (colisiones extremadamente improbables)."""
    while True:
        code = "LPR-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))
        if not Entry.objects.filter(unique_code=code).exists():
            return code


# ═══════════════════════════════════════════════════════════════
# GENERACIÓN DE ENTRIES (desde signal de Order)
# ═══════════════════════════════════════════════════════════════

@transaction.atomic
def generate_entries_for_order(order):
    """
    Recorre los items de una orden y genera Entries por cada producto
    que participe en una campaña activa. Idempotente: si ya se generaron
    entries para esta orden en la misma campaña, no se duplican.

    Retorna una lista de Entries creadas.
    """
    if not order.user_id:
        return []

    active_ids = list(get_active_campaigns().values_list("id", flat=True))
    if not active_ids:
        return []

    # Product IDs de la orden
    order_items = list(order.items.select_related("product").all())
    product_ids = [it.product_id for it in order_items if it.product_id]
    if not product_ids:
        return []

    reward_products = (
        RewardProduct.objects
        .filter(
            campaign_id__in=active_ids,
            product_id__in=product_ids,
            is_active=True,
        )
        .select_related("campaign")
    )
    if not reward_products.exists():
        return []

    # Idempotencia: (order, campaign) ya procesada?
    already = set(
        Entry.objects
        .filter(order=order, campaign_id__in=active_ids)
        .values_list("campaign_id", flat=True)
        .distinct()
    )

    created = []
    for rp in reward_products:
        if rp.campaign_id in already:
            continue

        # Buscar la cantidad comprada de este producto
        qty = sum(
            it.quantity for it in order_items
            if it.product_id == rp.product_id
        )
        if qty <= 0:
            continue

        total_entries = rp.entries_per_purchase * qty
        for _ in range(total_entries):
            entry = Entry.objects.create(
                campaign     = rp.campaign,
                user         = order.user,
                order        = order,
                product      = rp.product,
                unique_code  = _gen_unique_code(),
            )
            created.append(entry)

    return created


# ═══════════════════════════════════════════════════════════════
# SORTEO
# ═══════════════════════════════════════════════════════════════

class DrawError(Exception):
    """Errores de validación del sorteo."""


@transaction.atomic
def run_draw(campaign: Campaign, admin_user):
    """
    Ejecuta el sorteo de una campaña. No repite si ya se ejecutó.
    Selecciona 1 ganador principal + N suplentes usando secrets.choice
    (criptográficamente seguro).

    Retorna lista de Winners creados (principal + suplentes).
    """
    if campaign.is_drawn:
        raise DrawError("Esta campaña ya fue sorteada.")

    entries = list(campaign.entries.select_related("user"))
    if not entries:
        raise DrawError("La campaña no tiene participaciones.")

    total_winners = 1 + campaign.backup_winners_count
    winners = []
    used_users = set()
    used_entry_ids = set()

    # Preferimos que los suplentes sean usuarios distintos al principal.
    # Si no hay suficientes usuarios distintos, permitimos repetir usuario.
    for position in range(total_winners):
        pool = [
            e for e in entries
            if e.id not in used_entry_ids and e.user_id not in used_users
        ]
        if not pool:
            # Fallback: permitir usuarios repetidos si nos quedamos sin distintos
            pool = [e for e in entries if e.id not in used_entry_ids]
        if not pool:
            break

        chosen = secrets.choice(pool)
        used_entry_ids.add(chosen.id)
        used_users.add(chosen.user_id)

        winner = Winner.objects.create(
            campaign        = campaign,
            entry           = chosen,
            user            = chosen.user,
            user_email      = chosen.user.email,
            user_name       = f"{chosen.user.first_name} {chosen.user.last_name}".strip()
                              or chosen.user.email,
            is_backup       = position > 0,
            backup_position = position,
        )
        winners.append(winner)

    campaign.status   = CampaignStatus.FINISHED
    campaign.drawn_at = timezone.now()
    campaign.drawn_by = admin_user
    campaign.save(update_fields=["status", "drawn_at", "drawn_by"])

    return winners
