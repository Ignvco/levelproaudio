"""Synthetic fixtures for the isolated local PostgreSQL QA environment only.

Prints fresh test credentials to stdout: redirect stdout into a 0600 local file.
Refuses to run against any non-local database, even if invoked manually.
"""
import secrets
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = "Datos ficticios para QA local V3.2: NUNCA usar en producción."

    def handle(self, *args, **kwargs):
        db = connection.settings_dict
        if not (getattr(settings, "QA_LOCAL_ONLY", False) or __import__("os").environ.get("QA_LOCAL_ONLY") == "1"):
            raise CommandError("NO SEED: QA_LOCAL_ONLY != 1")
        if db.get("NAME") != "levelpro_v32_qa" or db.get("HOST") != "db":
            raise CommandError("NO SEED: destino no es db/levelpro_v32_qa")
        if db.get("USER") != "levelpro_qa":
            raise CommandError("NO SEED: usuario PostgreSQL inesperado")

        from django.contrib.auth import get_user_model
        from apps.products.models import Category, Brand, Product
        from apps.academy.models import Course, Module, Lesson, Enrollment
        from apps.services.models import ServiceCategory, Service, Booking, ServiceRequest
        from apps.rewards.models import Campaign, RewardProduct
        from apps.orders.models import Order, OrderItem, OrderStatus
        from apps.payments.models import PaymentMethodConfig, BankAccount

        User = get_user_model()
        passwords = {"admin": secrets.token_urlsafe(22), "customer": secrets.token_urlsafe(22)}
        accounts = {}
        for role, email, username in (
            ("admin", "qa-admin@levelpro.example.test", "qa_v32_admin"),
            ("customer", "qa-cliente@levelpro.example.test", "qa_v32_customer"),
        ):
            u, _ = User.objects.get_or_create(email=email, defaults={"username": username})
            u.is_staff = role == "admin"
            u.is_superuser = role == "admin"
            u.is_active = True
            u.set_password(passwords[role])
            u.save()
            accounts[role] = u
        category, _ = Category.objects.get_or_create(slug="qa-v32-sonido", defaults={"name": "QA · Sonido"})
        brand, _ = Brand.objects.get_or_create(slug="qa-v32", defaults={"name": "QA · LevelPro"})
        product, _ = Product.objects.update_or_create(slug="qa-v32-microfono-demo", defaults={
            "name": "QA · Micrófono ficticio", "category": category, "brand": brand,
            "description": "Producto exclusivo de pruebas, no vender.",
            "price": Decimal("50000.00"), "price_usd": Decimal("55.00"),
            "price_ars": Decimal("65000.00"), "cost_price": Decimal("25000.00"),
            "is_active": True, "stock": 30, "is_featured": True,
        })
        course, _ = Course.objects.update_or_create(slug="qa-v32-curso-demo", defaults={
            "title": "QA · Curso ficticio de audio", "description": "Curso sintético.",
            "price": Decimal("0.00"), "is_free": True, "is_published": True,
        })
        module, _ = Module.objects.get_or_create(course=course, title="Introducción QA", defaults={"order": 1})
        Lesson.objects.get_or_create(module=module, title="Lección sin contenido externo", defaults={"is_free": True, "order": 1})
        Enrollment.objects.get_or_create(user=accounts["customer"], course=course)
        svc_cat, _ = ServiceCategory.objects.get_or_create(slug="qa-v32-servicio", defaults={"name": "QA · Servicios"})
        service, _ = Service.objects.update_or_create(slug="qa-v32-servicio-demo", defaults={
            "name": "QA · Asesoría de audio ficticia", "category": svc_cat,
            "description": "Servicio exclusivo de pruebas.", "price_type": "quote", "is_active": True,
        })
        Booking.objects.get_or_create(
            user=accounts["customer"], service=service, notes="QA V32", defaults={"scheduled_date": timezone.now() + timedelta(days=12)}
        )
        ServiceRequest.objects.get_or_create(
            user=accounts["customer"], service=service, message="QA V32 solamente",
            defaults={"name": "Cliente QA", "email": "qa-cliente@levelpro.example.test"}
        )
        now = timezone.now()
        campaign, _ = Campaign.objects.update_or_create(slug="qa-v32-campana-demo", defaults={
            "name": "QA · Sorteo ficticio", "description": "No es un sorteo público real.",
            "main_prize": "Premio de demostración sin valor", "status": "active",
            "start_date": now-timedelta(days=1), "end_date": now+timedelta(days=30),
            "draw_date": now+timedelta(days=35), "sticker_price": Decimal("1000"),
            "legal_terms": "Prueba técnica. No constituye oferta, sorteo o participación real.",
        })
        RewardProduct.objects.update_or_create(campaign=campaign, product=product, defaults={"entries_per_purchase": 2, "is_active": True})
        order = Order.objects.filter(user=accounts["customer"], notes="QA V32 solamente").first()
        if order is None:
            order = Order.objects.create(
                user=accounts["customer"], email="qa-cliente@levelpro.example.test",
                total=Decimal("50000.00"), currency="CLP", status=OrderStatus.PENDING,
                shipping_address="Domicilio ficticio", notes="QA V32 solamente",
            )
            OrderItem.objects.create(order=order, product=product,
                product_name=product.name, price=Decimal("50000.00"), quantity=1)
        method, _ = PaymentMethodConfig.objects.update_or_create(method="transfer", defaults={
            "is_active": True, "label": "Transferencia de PRUEBA (NO PAGAR)", "currencies": "CLP,USD,ARS"})
        BankAccount.objects.update_or_create(label="QA NO REAL - NO TRANSFERIR", defaults={
            "payment_method": "transfer", "currency": "CLP", "bank_name": "BANCO FICTICIO QA",
            "account_number": "0000000000", "holder_name": "CUENTA FICTICIA QA",
            "holder_id": "NO-REAL", "is_active": True,
            "instructions": "Cuenta ficticia. NO realizar transferencias reales.",
        })
        # Never synthesize an approved payment, captured charge, payout or winner.
        self.stdout.write("LEVELPRO V3.2 / CREDENCIALES Y FIXTURES SOLO LOCALES")
        self.stdout.write("URL=http://127.0.0.1:3000")
        self.stdout.write(f"ADMIN_EMAIL={accounts['admin'].email}")
        self.stdout.write(f"ADMIN_PASSWORD={passwords['admin']}")
        self.stdout.write(f"CUSTOMER_EMAIL={accounts['customer'].email}")
        self.stdout.write(f"CUSTOMER_PASSWORD={passwords['customer']}")
        self.stdout.write(f"QA_PRODUCT_SLUG={product.slug}")
        self.stdout.write(f"QA_COURSE_SLUG={course.slug}")
        self.stdout.write(f"QA_SERVICE_SLUG={service.slug}")
        self.stdout.write(f"QA_CAMPAIGN_ID={campaign.id}")
        self.stdout.write(f"QA_ORDER_ID={order.id}")
        self.stdout.write("NO SE GENERARON COBROS NI PAGOS APROBADOS")
