from io import BytesIO
from PIL import Image
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.site_settings.serializers import SiteSettingsWriteSerializer
from apps.site_settings.models import SiteSettings


class DiagnosticoSubidaLogoTest(TestCase):
    """
    CRÍTICO — bug real encontrado en producción: DEFAULT_FILE_STORAGE
    como string suelto fue ELIMINADO por completo en Django 5.1. Al
    subir a Django 5.2.16 (por las vulnerabilidades de seguridad),
    Django empezó a ignorarlo en silencio y cayó en almacenamiento
    local (efímero en Cloud Run) para TODO archivo subido por el
    admin — sin ningún error, con 200 OK en cada request. El archivo
    "se guardaba" y desaparecía apenas el contenedor se reciclaba.
    Arreglado migrando a STORAGES (el diccionario, soportado desde
    Django 4.2). Este test usa almacenamiento local (config.settings.test
    no tiene credenciales de GCS) — lo que confirma es el flujo de
    guardado en sí, no el backend específico.
    """
    def test_el_archivo_guardado_tiene_el_tamano_correcto(self):
        buf = BytesIO()
        Image.new("RGB", (200, 200), color="red").save(buf, format="JPEG")
        image_bytes = buf.getvalue()

        uploaded = SimpleUploadedFile("test-logo.jpg", image_bytes, content_type="image/jpeg")
        ser = SiteSettingsWriteSerializer(data={"logo": uploaded}, partial=True)
        self.assertTrue(ser.is_valid(), ser.errors)

        obj = ser.save()
        obj.refresh_from_db()

        self.assertEqual(obj.logo.size, len(image_bytes),
            f"BUG: se guardaron {obj.logo.size} bytes en vez de {len(image_bytes)}")

        obj.logo.open("rb")
        content = obj.logo.read()
        obj.logo.close()
        self.assertEqual(len(content), len(image_bytes))


class ProductionStorageConfigTest(TestCase):
    """
    Confirma directamente contra el MÓDULO config.settings.production
    (no las settings activas del test runner, que son config.settings.test)
    que el storage por defecto apunta a GCS — esto es lo que falló en
    silencio cuando DEFAULT_FILE_STORAGE (string suelto) dejó de
    funcionar en Django 5.1+. Si alguna vez alguien vuelve a ese patrón
    viejo por error, este test lo agarra antes de que llegue a producción.
    """
    def test_production_settings_use_gcs_not_local_filesystem(self):
        import importlib
        import os

        # production.py usa env() sin default para varias variables —
        # necesita que existan para poder importarse como módulo plano,
        # sin pasar por el mecanismo real de Django settings.
        required = [
            "DB_NAME", "DB_USER", "DB_PASSWORD", "DJANGO_SECRET_KEY",
            "DJANGO_ALLOWED_HOSTS", "GCS_BUCKET_NAME", "GCS_PROJECT_ID",
            "CORS_ALLOWED_ORIGINS",
        ]
        old_values = {k: os.environ.get(k) for k in required}
        for k in required:
            os.environ.setdefault(k, "test-value")

        try:
            production = importlib.import_module("config.settings.production")
            importlib.reload(production)  # por si ya se importó antes sin las env vars
        finally:
            for k, v in old_values.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

        self.assertTrue(hasattr(production, "STORAGES"),
            "production.py no define STORAGES (el diccionario moderno) — "
            "si usa DEFAULT_FILE_STORAGE como string suelto, Django 5.1+ "
            "lo ignora en silencio y los archivos subidos se pierden.")
        self.assertIn("default", production.STORAGES)
        backend = production.STORAGES["default"]["BACKEND"]
        self.assertEqual(backend, "storages.backends.gcloud.GoogleCloudStorage",
            "El storage por defecto de producción no apunta a GCS — los "
            "archivos subidos se guardarían en el disco efímero del "
            "contenedor y se perderían apenas se reciclara.")
