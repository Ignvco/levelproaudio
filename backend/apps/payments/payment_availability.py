"""Centralized checkout payment availability rules.

Both public method discovery and POST creation must agree. We do not create
payment intents for unsupported currencies or manual methods without details.
"""
from django.conf import settings

from .models import BankAccount, PaymentMethodConfig, PaymentProvider


SUPPORTED_CURRENCIES = {
    PaymentProvider.MERCADOPAGO_CL: frozenset({"CLP"}),
    PaymentProvider.MERCADOPAGO_AR: frozenset({"ARS"}),
    PaymentProvider.PAYPAL: frozenset({"CLP", "USD"}),
    PaymentProvider.TRANSFER: frozenset({"CLP", "USD", "ARS"}),
    PaymentProvider.PAYONEER: frozenset({"USD"}),
    PaymentProvider.GLOBAL66: frozenset({"CLP"}),
}


def method_has_payment_instructions(provider, currency):
    """Return False for a method that would create an unpayable intent."""
    currency = (currency or "").strip().upper()
    if currency not in SUPPORTED_CURRENCIES.get(provider, frozenset()):
        return False
    if provider in (PaymentProvider.TRANSFER, PaymentProvider.PAYONEER):
        return BankAccount.objects.filter(
            payment_method=provider, currency__iexact=currency, is_active=True
        ).exists()
    if provider == PaymentProvider.GLOBAL66:
        return bool((getattr(settings, "GLOBAL66_ALIAS", "") or "").strip())
    return True


def method_can_checkout(provider, currency):
    """A method must be active, configured for currency and executable."""
    config = PaymentMethodConfig.objects.filter(
        method=provider, is_active=True
    ).first()
    return bool(
        config
        and config.available_for_currency(currency)
        and method_has_payment_instructions(provider, currency)
    )
