# apps/orders/urls.py
# Endpoints del carrito, pedidos y cotizaciones B2B

from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CartViewSet, OrderViewSet
from .views_b2b import (
    b2b_quote_create,
    admin_b2b_quotes,
    admin_b2b_quote_detail,
    admin_b2b_quote_convert,
)
from .oms_views import (
    public_whatsapp_proposal_view,
    public_whatsapp_checkout_continue_view,
)
from .crm_views import (
    admin_crm_customers_view,
    admin_crm_customer_360_view,
    admin_crm_technical_profile_view,
    admin_crm_interactions_view,
    admin_crm_organizations_view,
    admin_crm_org_contacts_view,
    admin_b2b_price_lists_view,
    admin_b2b_price_resolve_view,
    admin_b2b_quote_pro_create_view,
    admin_b2b_quote_status_view,
    admin_b2b_quote_pdf_view,
    admin_b2b_quote_share_view,
    admin_b2b_quote_convert_pro_view,
    admin_b2b_credit_accounts_view,
    admin_b2b_credit_decide_view,
)


router = DefaultRouter()

router.register(r'cart', CartViewSet, basename='cart')
router.register(r'orders', OrderViewSet, basename='orders')


urlpatterns = [
    path('b2b/quotes/', b2b_quote_create, name='b2b-quote-create'),
    path('orders/b2b/quotes/', b2b_quote_create, name='orders-b2b-quote-create'),
    path('admin/b2b/quotes/', admin_b2b_quotes, name='admin-b2b-quotes'),
    path('admin/orders/b2b/quotes/', admin_b2b_quotes, name='admin-orders-b2b-quotes'),
    path('admin/b2b/quotes/<uuid:quote_id>/', admin_b2b_quote_detail, name='admin-b2b-quote-detail'),
    path('admin/orders/b2b/quotes/<uuid:quote_id>/', admin_b2b_quote_detail, name='admin-orders-b2b-quote-detail'),
    path('admin/b2b/quotes/<uuid:quote_id>/convert/', admin_b2b_quote_convert, name='admin-b2b-quote-convert'),
    path('admin/orders/b2b/quotes/<uuid:quote_id>/convert/', admin_b2b_quote_convert, name='admin-orders-b2b-quote-convert'),
    path('orders/whatsapp/<path:token>/checkout/', public_whatsapp_checkout_continue_view, name='orders-whatsapp-checkout'),
    path('orders/whatsapp/<path:token>/', public_whatsapp_proposal_view, name='orders-whatsapp-proposal'),
    # GATE 8: CRM & B2B Management
    path('admin/crm/customers/', admin_crm_customers_view, name='admin-crm-customers'),
    path('admin/crm/customers/<uuid:customer_id>/360/', admin_crm_customer_360_view, name='admin-crm-customer-360'),
    path('admin/crm/customers/<uuid:customer_id>/technical-profile/', admin_crm_technical_profile_view, name='admin-crm-technical-profile'),
    path('admin/crm/customers/<uuid:customer_id>/interactions/', admin_crm_interactions_view, name='admin-crm-interactions'),
    path('admin/crm/organizations/', admin_crm_organizations_view, name='admin-crm-organizations'),
    path('admin/crm/organizations/<uuid:org_id>/contacts/', admin_crm_org_contacts_view, name='admin-crm-org-contacts'),
    path('admin/b2b/price-lists/', admin_b2b_price_lists_view, name='admin-b2b-price-lists'),
    path('admin/b2b/price-lists/resolve/', admin_b2b_price_resolve_view, name='admin-b2b-price-resolve'),
    path('admin/b2b/quotes/pro/', admin_b2b_quote_pro_create_view, name='admin-b2b-quote-pro'),
    path('admin/b2b/quotes/<uuid:quote_id>/status/', admin_b2b_quote_status_view, name='admin-b2b-quote-status'),
    path('admin/b2b/quotes/<uuid:quote_id>/pdf/', admin_b2b_quote_pdf_view, name='admin-b2b-quote-pdf'),
    path('admin/b2b/quotes/<uuid:quote_id>/share/', admin_b2b_quote_share_view, name='admin-b2b-quote-share'),
    path('admin/b2b/quotes/<uuid:quote_id>/convert-pro/', admin_b2b_quote_convert_pro_view, name='admin-b2b-quote-convert-pro'),
    path('admin/b2b/credit-accounts/', admin_b2b_credit_accounts_view, name='admin-b2b-credit-accounts'),
    path('admin/b2b/credit-accounts/<uuid:account_id>/decide/', admin_b2b_credit_decide_view, name='admin-b2b-credit-decide'),
] + router.urls
