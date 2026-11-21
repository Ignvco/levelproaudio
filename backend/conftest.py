# backend/conftest.py
"""Pytest fixtures y configuración global para pruebas en LEVELPRO OS V4.0."""

import re
import pytest
from django.db.backends.base.operations import BaseDatabaseOperations

_orig_execute_sql_flush = BaseDatabaseOperations.execute_sql_flush


def _audit_preserving_execute_sql_flush(self, sql_list):
    """
    Durante el vaciado de tablas de pruebas (sql_flush), activa temporalmente el token de mantenimiento
    de sesión para permitir el vaciado coordinado con integridad referencial, y luego lo resetea de inmediato.
    """
    with self.connection.cursor() as cursor:
        cursor.execute("SET levelpro.maintenance_audit_maintenance_active = 'active_authorized_maintenance';")
        try:
            return _orig_execute_sql_flush(self, sql_list)
        finally:
            cursor.execute("RESET levelpro.maintenance_audit_maintenance_active;")


BaseDatabaseOperations.execute_sql_flush = _audit_preserving_execute_sql_flush
