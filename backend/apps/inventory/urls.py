# apps/inventory/urls.py
from django.urls import path
from apps.inventory.views import (
    admin_serials_list,
    admin_serials_regularize,
    admin_serials_set_mode,
    admin_warehouse_detail,
    admin_warehouses_list,
    admin_wms_adjust,
    admin_wms_dispatch_order,
    admin_wms_expire_reservations,
    admin_wms_kardex,
    admin_wms_reservations,
    admin_wms_stocks,
    admin_wms_transfer_receive,
    admin_wms_transfers,
)

urlpatterns = [
    path("inventory/warehouses/", admin_warehouses_list, name="admin-wms-warehouses"),
    path("inventory/warehouses/<uuid:warehouse_id>/", admin_warehouse_detail, name="admin-wms-warehouse-detail"),
    path("inventory/stocks/", admin_wms_stocks, name="admin-wms-stocks"),
    path("inventory/adjust/", admin_wms_adjust, name="admin-wms-adjust"),
    path("inventory/kardex/", admin_wms_kardex, name="admin-wms-kardex"),
    path("inventory/reservations/", admin_wms_reservations, name="admin-wms-reservations"),
    path("inventory/reservations/expire/", admin_wms_expire_reservations, name="admin-wms-expire-reservations"),
    path("inventory/transfers/", admin_wms_transfers, name="admin-wms-transfers"),
    path("inventory/transfers/<uuid:transfer_id>/receive/", admin_wms_transfer_receive, name="admin-wms-transfer-receive"),
    path("inventory/orders/<uuid:order_id>/dispatch/", admin_wms_dispatch_order, name="admin-wms-dispatch-order"),
    path("serials/", admin_serials_list, name="admin-serials-list"),
    path("serials/regularize/", admin_serials_regularize, name="admin-serials-regularize"),
    path("serials/mode/", admin_serials_set_mode, name="admin-serials-set-mode"),
]
