# apps/analytics/admin.py
"""Registro en Django Admin para modelos de analítica y auditoría LEVELPRO OS V4.0."""

from django.contrib import admin
from .models import (
    DistributionCategory,
    IncomeRecord,
    IncomeDistribution,
    Withdrawal,
    WithdrawalDeletionLog,
    AuditEvent,
)


@admin.register(DistributionCategory)
class DistributionCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "cat_type", "percentage", "order", "is_active")
    list_filter = ("cat_type", "is_active")
    search_fields = ("name",)


@admin.register(IncomeRecord)
class IncomeRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "amount", "currency", "source", "order", "created_at")
    list_filter = ("source", "currency", "created_at")
    search_fields = ("order__id", "description")


@admin.register(IncomeDistribution)
class IncomeDistributionAdmin(admin.ModelAdmin):
    list_display = ("id", "income_record", "category", "amount", "created_at")
    list_filter = ("category",)


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "amount", "currency", "destination", "created_by", "created_at")
    list_filter = ("category", "currency", "created_at")
    search_fields = ("destination", "reference", "notes")


@admin.register(WithdrawalDeletionLog)
class WithdrawalDeletionLogAdmin(admin.ModelAdmin):
    list_display = ("original_id", "category_name", "amount", "currency", "deleted_by", "created_at")
    list_filter = ("currency", "created_at")
    search_fields = ("destination", "category_name")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    """
    Vista de sólo lectura para eventos de auditoría en Django Admin.
    Inmutabilidad estricta: bloquea add, change y delete a nivel de interfaz administrativa.
    """
    list_display = (
        "created_at",
        "module",
        "action",
        "event_category",
        "result",
        "severity",
        "actor_email",
        "resource_repr",
        "correlation_id",
    )
    list_filter = ("result", "severity", "module", "event_category", "created_at")
    search_fields = (
        "actor_email",
        "actor_username",
        "action",
        "resource_repr",
        "resource_id",
        "correlation_id",
        "ip_address",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_actions(self, request):
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            del actions["delete_selected"]
        return actions
