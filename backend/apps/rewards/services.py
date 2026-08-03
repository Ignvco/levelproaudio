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

def _send_ticket_email_safe(email, campaign, codes):
    if not codes:
        return
    try:
        from apps.emails import send_ticket_email
        send_ticket_email(email, campaign, codes)
    except Exception:
        pass


@transaction.atomic
def generate_entries_for_order(order):
    """
    Genera las Entries (tickets) que corresponden a una orden pagada.
    Idempotente: nunca duplica entries si el signal se dispara de nuevo
    (ej: paid → shipped → completed).

    Hay DOS caminos independientes, y una orden puede disparar ambos:

    1. Compra de stickers (StickerPurchase) — cada sticker = 1 Entry.

    2. Producto participante (RewardProduct) — cada unidad comprada de
       un producto configurado en una campaña activa genera N Entries
       (entries_per_purchase × cantidad). ANTES, esta función solo
       manejaba el camino 1 — el modelo, el admin completo (con su
       propia UI de "productos participantes"), y hasta un endpoint de
       preview para el carrito existían, pero comprar un producto
       participante nunca generaba ninguna participación real.
    """
    if not order.user_id:
        return []

    created = []

    # ── 1. Stickers ──────────────────────────────────────────
    sp = getattr(order, "sticker_purchase", None)
    if sp and not Entry.objects.filter(order=order, campaign=sp.campaign, product__isnull=True).exists():
        sticker_entries = [
            Entry.objects.create(
                campaign=sp.campaign, user=order.user, order=order,
                product=None, unique_code=_gen_unique_code(),
            )
            for _ in range(sp.quantity)
        ]
        created.extend(sticker_entries)
        _send_ticket_email_safe(order.email, sp.campaign, [e.unique_code for e in sticker_entries])

    # ── 2. Productos participantes ───────────────────────────
    now = timezone.now()
    for item in order.items.select_related("product"):
        if not item.product_id:
            continue
        rps = RewardProduct.objects.filter(
            product_id=item.product_id, is_active=True,
            campaign__status=CampaignStatus.ACTIVE,
            campaign__start_date__lte=now,
            campaign__end_date__gte=now,
        ).select_related("campaign")

        for rp in rps:
            # Idempotencia por (order, campaign, product)
            if Entry.objects.filter(order=order, campaign=rp.campaign, product_id=item.product_id).exists():
                continue
            n = rp.entries_per_purchase * item.quantity
            if n <= 0:
                continue
            product_entries = [
                Entry.objects.create(
                    campaign=rp.campaign, user=order.user, order=order,
                    product_id=item.product_id, unique_code=_gen_unique_code(),
                )
                for _ in range(n)
            ]
            created.extend(product_entries)
            _send_ticket_email_safe(order.email, rp.campaign, [e.unique_code for e in product_entries])

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
