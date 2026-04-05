# apps/loyalty/urls.py

from django.urls import path
from .views import (
    my_loyalty,
    redeem_points,
    admin_loyalty_summary,
    admin_loyalty_config,
    admin_adjust_points,
)

urlpatterns = [
    # Cliente
    path("me/",     my_loyalty,    name="loyalty-me"),
    path("redeem/", redeem_points, name="loyalty-redeem"),

    # Admin
    path("admin/summary/", admin_loyalty_summary, name="loyalty-admin-summary"),
    path("admin/config/",  admin_loyalty_config,  name="loyalty-admin-config"),
    path("admin/adjust/",  admin_adjust_points,   name="loyalty-admin-adjust"),
]