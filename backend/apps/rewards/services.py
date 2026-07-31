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
    Genera las Entries (tickets) de una orden de compra de stickers.
    Cada sticker comprado = 1 Entry con código único.
    Idempotente: si ya se generaron entries para esta orden/campaña, no duplica.

    Retorna una lista de Entries creadas.
    """
    if not order.user_id:
        return []

    sp = getattr(order, "sticker_purchase", None)
    if not sp:
        return []

    # Idempotencia
    if Entry.objects.filter(order=order, campaign=sp.campaign).exists():
        return []

    created = []
    for _ in range(sp.quantity):
        entry = Entry.objects.create(
            campaign     = sp.campaign,
            user         = order.user,
            order        = order,
            product      = None,
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
