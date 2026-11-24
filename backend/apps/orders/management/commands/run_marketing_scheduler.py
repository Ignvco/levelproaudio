# apps/orders/management/commands/run_marketing_scheduler.py
from django.core.management.base import BaseCommand

from apps.orders.marketing_services import (
    detect_abandoned_carts,
    prepare_and_dispatch_cart_recovery,
    run_scheduled_promotions_tick,
)


class Command(BaseCommand):
    help = "Ejecuta el tick idempotente de promociones programadas y detección de carritos abandonados (Gate 11)."

    def add_arguments(self, parser):
        parser.add_argument("--inactivity-minutes", type=int, default=60)
        parser.add_argument("--dispatch-recovery", action="store_true")

    def handle(self, *args, **options):
        promo_result = run_scheduled_promotions_tick()
        triggers = detect_abandoned_carts(inactivity_minutes=options["inactivity_minutes"])
        dispatched = 0
        if options["dispatch_recovery"]:
            for trg in triggers:
                if trg.status == "eligible":
                    res = prepare_and_dispatch_cart_recovery(trg.id)
                    if res.get("status") in {"skipped_qa", "queued"}:
                        dispatched += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Scheduler Gate 11 OK: promos_activated={promo_result['activated']} "
                f"promos_finished={promo_result['finished']} "
                f"abandoned_triggers={len(triggers)} dispatched={dispatched}"
            )
        )
