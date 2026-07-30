# apps/products/urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, BrandViewSet, ProductViewSet,
    my_favorites, toggle_favorite, favorite_ids,
)

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('brands', BrandViewSet, basename='brand')
router.register('products', ProductViewSet, basename='product')

urlpatterns = [
    path('favorites/', my_favorites, name='my-favorites'),
    path('favorites/toggle/', toggle_favorite, name='toggle-favorite'),
    path('favorites/ids/', favorite_ids, name='favorite-ids'),
] + router.urls
