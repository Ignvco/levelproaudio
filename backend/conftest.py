# backend/conftest.py
"""Pytest fixtures y configuración global para pruebas en LEVELPRO OS V4.0."""

import pytest
from django.db.backends.base.operations import BaseDatabaseOperations

# Monkey-patch BaseDatabaseOperations.execute_sql_flush para permitir el vaciado controlado
# de tablas de prueba sin deshabilitar permanentemente el trigger de inmutabilidad de PostgreSQL.
_orig_execute_sql_flush = BaseDatabaseOperations.execute_sql_flush


def _audit_aware_execute_sql_flush(self, sql_list):
    if self.connection.vendor == "postgresql":
        with self.connection.cursor() as cursor:
            cursor.execute("SET levelpro.allow_audit_truncate = 'on';")
            try:
                return _orig_execute_sql_flush(self, sql_list)
            finally:
                cursor.execute("SET levelpro.allow_audit_truncate = 'off';")
    return _orig_execute_sql_flush(self, sql_list)


BaseDatabaseOperations.execute_sql_flush = _audit_aware_execute_sql_flush
