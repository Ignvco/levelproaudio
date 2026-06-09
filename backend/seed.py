"""
Seed básico para iterar en local: superuser + categorías, marcas, productos,
cursos, módulos, lecciones, servicios y solicitudes.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from django.contrib.auth import get_user_model
from apps.products.models   import Category, Brand, Product
from apps.academy.models    import Course, Module, Lesson
from apps.services.models   import ServiceCategory, Service, ServiceRequest

User = get_user_model()

# ── Superuser ────────────────────────────────────────────────
admin_email = "ventas@levelproaudio.com"
admin_pass  = "[REDACTED]"
if not User.objects.filter(email=admin_email).exists():
    User.objects.create_superuser(
        email=admin_email,
        username="ventas",
        password=admin_pass,
        first_name="LevelPro",
        last_name="Admin",
    )
    print(f"✓ Superuser creado: {admin_email} / {admin_pass}")
else:
    u = User.objects.get(email=admin_email)
    u.set_password(admin_pass)
    u.is_staff = True
    u.is_superuser = True
    u.save()
    print(f"✓ Superuser actualizado: {admin_email}")

# ── Cliente de prueba ────────────────────────────────────────
if not User.objects.filter(email="cliente@test.com").exists():
    User.objects.create_user(
        email="cliente@test.com",
        username="cliente",
        password="[REDACTED]",
        first_name="Juan",
        last_name="Pérez",
    )
    print("✓ Cliente de prueba creado")

# ── Categorías ───────────────────────────────────────────────
cats = [
    ("Audífonos",   "audifonos"),
    ("Micrófonos",  "microfonos"),
    ("Interfaces",  "interfaces"),
    ("Monitores",   "monitores"),
    ("Controladores", "controladores"),
]
for name, slug in cats:
    Category.objects.get_or_create(slug=slug, defaults={"name": name, "is_active": True})

# ── Marcas ───────────────────────────────────────────────────
brands = [("Shure", "shure"), ("Sennheiser", "sennheiser"),
          ("Universal Audio", "universal-audio"), ("Focusrite", "focusrite"),
          ("KRK", "krk"), ("Neumann", "neumann")]
for name, slug in brands:
    Brand.objects.get_or_create(slug=slug, defaults={"name": name, "is_active": True})

# ── Productos ────────────────────────────────────────────────
prods = [
    ("Shure SM7B Micrófono Dinámico", "shure-sm7b", "microfonos", "shure", 549990, True),
    ("Focusrite Scarlett 4i4 4Gen",   "focusrite-4i4", "interfaces", "focusrite", 329990, True),
    ("KRK Rokit 5 G4",                "krk-rokit-5",  "monitores", "krk",       289990, False),
    ("Sennheiser HD 660S2",           "sennheiser-hd660s2", "audifonos", "sennheiser", 499990, True),
    ("Universal Audio Apollo Twin X", "ua-apollo-twin-x", "interfaces", "universal-audio", 1290000, True),
    ("Neumann TLM 103",               "neumann-tlm-103", "microfonos", "neumann", 1090000, False),
]
for name, slug, cat, br, price, feat in prods:
    Product.objects.get_or_create(
        slug=slug,
        defaults={
            "name": name,
            "category": Category.objects.get(slug=cat),
            "brand": Brand.objects.get(slug=br),
            "short_description": f"{name} — calidad de estudio profesional.",
            "description": f"{name}. Equipamiento de referencia para audio profesional.",
            "price": price,
            "stock": 12,
            "is_featured": feat,
            "is_active": True,
        },
    )

# ── Academia ─────────────────────────────────────────────────
courses_data = [
    ("Mezcla profesional desde cero", "mezcla-profesional", 0, "beginner", True),
    ("Mastering en cadena análoga",  "mastering-analogo",  119990, "advanced", False),
    ("Producción de música electrónica", "produccion-electronica", 89990, "intermediate", False),
]
for title, slug, price, level, is_free in courses_data:
    c, _ = Course.objects.get_or_create(
        slug=slug,
        defaults={
            "title": title,
            "description": f"Curso completo: {title}.",
            "short_description": f"Aprende {title.lower()} con un enfoque profesional.",
            "price": price,
            "level": level,
            "is_free": is_free,
            "is_published": True,
        },
    )
    for i, mtitle in enumerate(["Fundamentos", "Práctica", "Proyecto Final"]):
        m, _ = Module.objects.get_or_create(course=c, title=mtitle, defaults={"order": i})
        for j, ltitle in enumerate(["Introducción", "Demostración", "Ejercicio"]):
            Lesson.objects.get_or_create(
                module=m, title=ltitle,
                defaults={
                    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "duration_minutes": 12 + j * 5,
                    "is_free": (i == 0 and j == 0),
                    "order": j,
                },
            )

# ── Servicios ────────────────────────────────────────────────
sc, _ = ServiceCategory.objects.get_or_create(slug="estudio", defaults={"name": "Estudio"})
sc2, _ = ServiceCategory.objects.get_or_create(slug="live", defaults={"name": "Vivo"})

services_data = [
    ("Mezcla profesional", "mezcla-pro", sc, 250000, "fixed",
     "Mezcla de hasta 24 pistas para tu canción."),
    ("Mastering",           "mastering",  sc, 80000,  "fixed",
     "Mastering profesional listo para Spotify, Apple Music, etc."),
    ("Operador de sonido en vivo", "operador-vivo", sc2, None, "hourly",
     "Servicio de operación de FOH/monitores para eventos."),
    ("Asesoría de estudio",  "asesoria-estudio", sc, None, "quote",
     "Consultoría para acondicionamiento y compra de equipamiento."),
]
for name, slug, cat, price, ptype, desc in services_data:
    Service.objects.get_or_create(
        slug=slug,
        defaults={
            "name": name, "category": cat, "description": desc,
            "short_description": desc, "price": price, "price_type": ptype,
            "is_active": True,
        },
    )

# ── Solicitudes demo ─────────────────────────────────────────
cliente = User.objects.get(email="cliente@test.com")
servicio_mezcla = Service.objects.get(slug="mezcla-pro")
ServiceRequest.objects.get_or_create(
    user=cliente, service=servicio_mezcla,
    defaults={
        "name": "Juan Pérez", "email": "cliente@test.com", "phone": "+56912345678",
        "message": "Necesito mezcla para 3 tracks indie. ¿Cuánto demora?",
        "status": "pending",
    },
)

print("✓ Seed completo")
