"""Opaque API errors; validation/authentication responses keep DRF semantics."""
import logging
from uuid import uuid4

from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback

logger = logging.getLogger(__name__)


class AdminInputError(ValueError):
    """An explicit, user-facing validation message, never an SDK/DB exception."""


def api_error_response(message, *, operation, status_code=500):
    error_id = uuid4().hex
    # Do not add request bodies, cookies, headers or tokens to the context.
    logger.exception("API error error_id=%s operation=%s", error_id, operation)
    return Response({"error": message, "error_id": error_id}, status=status_code)


def safe_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response
    set_rollback()
    return api_error_response(
        "No pudimos completar la operación. Revisa su estado antes de repetirla.",
        operation=type(context.get("view")).__name__,
    )
