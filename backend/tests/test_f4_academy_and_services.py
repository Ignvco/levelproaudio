# backend/tests/test_f4_academy_and_services.py
"""
Suite de certificación integral para Academia, Usuarios y Servicios Profesionales (Fase F4).
Cubre:
1. ACD-01 (#26): Cursos, Módulos, Lecciones, Matrículas, Progreso y completitud automática.
2. ACD-02 (#27): Paywall de video, control de acceso y endpoint de URLs firmadas GCS.
3. ACD-03 (#28): Generación de certificados individuales y sellos de rutas de certificación (PDFs).
4. SRV-01 (#29) & SRV-02 (#30): Solicitudes de servicio, cotizaciones, aceptación con generación automática
   de reservas (Booking), cancelación con registro de fecha y aislamiento de permisos.
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.test import override_settings
import pytest
from rest_framework.test import APIClient

from apps.academy.models import Course, Module, Lesson, Enrollment, LessonProgress, CertificationPath
from apps.academy.serializers import LessonSerializer
from apps.services.models import ServiceCategory, Service, Booking, ServiceRequest
from apps.orders.models import Order

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def users(db):
    alumno_a = User.objects.create_user(
        email="alumno_a@levelpro.cl", username="alumno_a", password="secure_password_a",
        first_name="Carlos", last_name="Santana"
    )
    alumno_b = User.objects.create_user(
        email="alumno_b@levelpro.cl", username="alumno_b", password="secure_password_b",
        first_name="Gustavo", last_name="Cerati"
    )
    admin_user = User.objects.create_superuser(
        email="admin_academy@levelpro.cl", username="admin_academy", password="secure_password_admin"
    )
    return {"a": alumno_a, "b": alumno_b, "admin": admin_user}


@pytest.fixture
def academy_fixtures(db):
    course_free = Course.objects.create(
        title="Fundamentos de Acústica",
        slug="fundamentos-acustica",
        description="Curso introductorio",
        price=Decimal("0.00"),
        is_free=True,
        is_published=True,
    )
    mod_free = Module.objects.create(course=course_free, title="Módulo 1: Ondas y Frecuencias", order=1)
    les_free_1 = Lesson.objects.create(
        module=mod_free, title="1.1 Qué es el sonido", order=1, is_free=True,
        video_url="https://videos.levelproaudio.com/free/intro.mp4", duration_minutes=15
    )
    les_free_2 = Lesson.objects.create(
        module=mod_free, title="1.2 Propagación", order=2, is_free=True,
        video_url="https://videos.levelproaudio.com/free/prop.mp4", duration_minutes=20
    )

    course_paid = Course.objects.create(
        title="Mastering Análogo Pro",
        slug="mastering-analogo-pro",
        description="Mastering profesional avanzado",
        price=Decimal("89000.00"),
        is_free=False,
        is_published=True,
    )
    mod_paid = Module.objects.create(course=course_paid, title="Módulo 1: Cadena Análoga", order=1)
    les_paid_1 = Lesson.objects.create(
        module=mod_paid, title="1.1 Compresión multibanda", order=1, is_free=False,
        video_url="https://videos.levelproaudio.com/paid/comp.mp4", duration_minutes=35
    )

    cert_path = CertificationPath.objects.create(
        title="Ingeniero de Sonido Certificado LevelPro",
        slug="ingeniero-sonido-certificado",
        seal_label="Profesional Certificado LevelPro Audio",
        is_published=True,
    )
    cert_path.courses.add(course_free, course_paid)

    return {
        "course_free": course_free,
        "les_free_1": les_free_1,
        "les_free_2": les_free_2,
        "course_paid": course_paid,
        "les_paid_1": les_paid_1,
        "cert_path": cert_path,
    }


# ==============================================================================
# ACD-01: CURSOS, MATRÍCULAS, PROGRESO Y FINALIZACIÓN
# ==============================================================================

@pytest.mark.django_db
def test_acd01_free_course_enrollment_and_progress_completion(api, users, academy_fixtures):
    alumno = users["a"]
    cf = academy_fixtures["course_free"]
    l1 = academy_fixtures["les_free_1"]
    l2 = academy_fixtures["les_free_2"]

    api.force_authenticate(user=alumno)

    # 1. Matrícula en curso gratuito
    resp = api.post(f"/api/v1/courses/{cf.slug}/enroll/")
    assert resp.status_code == 201
    assert Enrollment.objects.filter(user=alumno, course=cf).exists()

    # 2. Doble matrícula debe ser rechazada
    dup_resp = api.post(f"/api/v1/courses/{cf.slug}/enroll/")
    assert dup_resp.status_code == 400
    assert "Ya estás inscrito" in dup_resp.data["detail"]

    # 3. Marcar progreso lección 1
    p1_resp = api.post("/api/v1/progress/", {"lesson_id": l1.id, "completed": True}, format="json")
    assert p1_resp.status_code == 200

    enrollment = Enrollment.objects.get(user=alumno, course=cf)
    assert enrollment.progress_percentage == 50
    assert enrollment.completed_at is None

    # 4. Marcar progreso lección 2 (100% completitud)
    p2_resp = api.post("/api/v1/progress/", {"lesson_id": l2.id, "completed": True}, format="json")
    assert p2_resp.status_code == 200

    enrollment.refresh_from_db()
    assert enrollment.progress_percentage == 100
    assert enrollment.completed_at is not None  # Auto-finalizado al 100%


@pytest.mark.django_db
def test_acd01_paid_course_purchase_creates_digital_order(api, users, academy_fixtures):
    alumno = users["a"]
    cp = academy_fixtures["course_paid"]

    api.force_authenticate(user=alumno)

    resp = api.post(f"/api/v1/courses/{cp.slug}/purchase/")
    assert resp.status_code == 201
    order_id = resp.data["order_id"]

    order = Order.objects.get(id=order_id)
    assert order.user == alumno
    assert order.total == cp.price
    assert order.stock_deductions == {}  # No reserva inventario físico


@pytest.mark.django_db
def test_acd01_admin_enrollment_management_and_pagination(api, users, academy_fixtures):
    admin = users["admin"]
    alumno = users["b"]
    cf = academy_fixtures["course_free"]

    api.force_authenticate(user=admin)

    # Admin crea matrícula manual
    create_resp = api.post(
        "/api/v1/admin/academy/enrollments/create/",
        {"user_id": str(alumno.id), "course_id": str(cf.id)},
        format="json"
    )
    assert create_resp.status_code == 200
    assert create_resp.data["created"] is True
    enrollment_id = create_resp.data["enrollment_id"]

    # Admin consulta lista paginada
    list_resp = api.get("/api/v1/admin/academy/enrollments/?page=1&page_size=10")
    assert list_resp.status_code == 200
    assert "count" in list_resp.data
    assert any(item["id"] == enrollment_id for item in list_resp.data["results"])

    # Admin elimina matrícula
    del_resp = api.delete(f"/api/v1/admin/academy/enrollments/{enrollment_id}/")
    assert del_resp.status_code == 200
    assert not Enrollment.objects.filter(id=enrollment_id).exists()


# ==============================================================================
# ACD-02: VIDEO PAYWALL Y URLS FIRMADAS
# ==============================================================================

@pytest.mark.django_db
def test_acd02_video_paywall_isolation(api, users, academy_fixtures):
    alumno = users["a"]
    cp = academy_fixtures["course_paid"]
    lp = academy_fixtures["les_paid_1"]

    # 1. Usuario anónimo: bloqueado
    anon_data = LessonSerializer(lp, context={"request": None}).data
    assert anon_data["is_locked"] is True
    assert anon_data["video_url"] is None
    assert anon_data["video_source"] is None

    # 2. Usuario no matriculado: bloqueado
    api.force_authenticate(user=alumno)
    client_request = api.get(f"/api/v1/courses/{cp.slug}/").wsgi_request
    unregistered_data = LessonSerializer(lp, context={"request": client_request}).data
    assert unregistered_data["is_locked"] is True
    assert unregistered_data["video_source"] is None

    # 3. Usuario matriculado: desbloqueado
    Enrollment.objects.create(user=alumno, course=cp)
    registered_data = LessonSerializer(lp, context={"request": client_request}).data
    assert registered_data["is_locked"] is False
    assert registered_data["video_source"] == lp.video_url


@pytest.mark.django_db
@override_settings(GS_BUCKET_NAME="fake-bucket-test")
@patch("google.auth.default")
@patch("google.cloud.storage.Client")
def test_acd02_signed_upload_url_permissions_and_validation(mock_gcs, mock_auth, api, users):
    admin = users["admin"]
    alumno = users["a"]

    # Mock GCS client & ADC
    mock_blob = MagicMock()
    mock_blob.generate_signed_url.return_value = "https://storage.googleapis.com/test-bucket/signed-url"
    mock_gcs.return_value.bucket.return_value.blob.return_value = mock_blob
    mock_creds = MagicMock()
    mock_creds.service_account_email = "test@gserviceaccount.com"
    mock_creds.token = "token123"
    mock_auth.return_value = (mock_creds, "test-proj")

    # 1. Alumno no puede solicitar URL firmada (403)
    api.force_authenticate(user=alumno)
    forbidden_resp = api.post("/api/v1/admin/academy/lessons/upload-url/", {"filename": "video.mp4"}, format="json")
    assert forbidden_resp.status_code == 403

    # 2. Admin solicita con formato no admitido (400)
    api.force_authenticate(user=admin)
    bad_ext_resp = api.post("/api/v1/admin/academy/lessons/upload-url/", {"filename": "malware.exe"}, format="json")
    assert bad_ext_resp.status_code == 400
    assert "no soportado" in bad_ext_resp.data["error"]

    # 3. Admin solicita formato válido (200)
    ok_resp = api.post("/api/v1/admin/academy/lessons/upload-url/", {"filename": "leccion.mp4"}, format="json")
    assert ok_resp.status_code == 200
    assert ok_resp.data["upload_url"] == "https://storage.googleapis.com/test-bucket/signed-url"
    assert ok_resp.data["object_path"].startswith("academy/videos/")


# ==============================================================================
# ACD-03: CERTIFICADOS Y SELLOS DE CERTIFICACIÓN
# ==============================================================================

@pytest.mark.django_db
def test_acd03_certificate_generation_and_security(api, users, academy_fixtures):
    alumno_a = users["a"]
    alumno_b = users["b"]
    cf = academy_fixtures["course_free"]

    enrollment = Enrollment.objects.create(user=alumno_a, course=cf)

    api.force_authenticate(user=alumno_a)

    # 1. Descarga antes de completar el curso falla (400)
    fail_resp = api.get(f"/api/v1/enrollments/{enrollment.id}/certificate/")
    assert fail_resp.status_code == 400
    assert "Todavía no completaste" in fail_resp.data["error"]

    # 2. Descarga al completar el curso genera PDF válido
    enrollment.completed_at = timezone.now()
    enrollment.save(update_fields=["completed_at"])

    ok_resp = api.get(f"/api/v1/enrollments/{enrollment.id}/certificate/")
    assert ok_resp.status_code == 200
    assert ok_resp["Content-Type"] == "application/pdf"
    assert ok_resp.content.startswith(b"%PDF")

    # 3. Alumno B no puede descargar el certificado de Alumno A (404)
    api.force_authenticate(user=alumno_b)
    denied_resp = api.get(f"/api/v1/enrollments/{enrollment.id}/certificate/")
    assert denied_resp.status_code == 404


@pytest.mark.django_db
def test_acd03_certification_path_seal_validation(api, users, academy_fixtures):
    alumno = users["a"]
    cf = academy_fixtures["course_free"]
    cp = academy_fixtures["course_paid"]
    path = academy_fixtures["cert_path"]

    api.force_authenticate(user=alumno)

    # Completa solo 1 de los 2 cursos de la ruta
    Enrollment.objects.create(user=alumno, course=cf, completed_at=timezone.now())

    seal_fail = api.get(f"/api/v1/certifications/{path.slug}/certificate/")
    assert seal_fail.status_code == 400
    assert "1/2 cursos" in seal_fail.data["error"]

    # Completa el segundo curso
    Enrollment.objects.create(user=alumno, course=cp, completed_at=timezone.now())

    seal_ok = api.get(f"/api/v1/certifications/{path.slug}/certificate/")
    assert seal_ok.status_code == 200
    assert seal_ok["Content-Type"] == "application/pdf"
    assert seal_ok.content.startswith(b"%PDF")


# ==============================================================================
# SRV-01 & SRV-02: SOLICITUDES, RESERVAS Y SEGUIMIENTO DE SERVICIOS
# ==============================================================================

@pytest.fixture
def service_fixtures(db):
    cat = ServiceCategory.objects.create(name="Producción & Mezcla", slug="produccion-mezcla")
    svc_fixed = Service.objects.create(
        name="Mastering Stereo 1 Track",
        slug="mastering-stereo-1-track",
        category=cat,
        price=Decimal("45000.00"),
        price_type=Service.PriceType.FIXED,
        is_active=True,
    )
    svc_quote = Service.objects.create(
        name="Diseño Acústico de Control Room",
        slug="diseno-acustico-control-room",
        category=cat,
        price_type=Service.PriceType.QUOTE,
        is_active=True,
    )
    return {"cat": cat, "svc_fixed": svc_fixed, "svc_quote": svc_quote}


@pytest.mark.django_db
def test_srv01_service_request_lifecycle_and_auto_booking(api, users, service_fixtures):
    cliente = users["a"]
    admin = users["admin"]
    svc = service_fixtures["svc_quote"]

    api.force_authenticate(user=cliente)

    # 1. Cliente crea solicitud de servicio con cotización
    payload = {
        "service": str(svc.id),
        "name": "Carlos Santana",
        "email": cliente.email,
        "phone": "+56991122334",
        "message": "Necesito diseño acústico para estudio de 25m2 en Vitacura.",
        "budget": "800000.00",
    }
    create_resp = api.post("/api/v1/service-requests/", payload, format="json")
    assert create_resp.status_code == 201
    sr_id = create_resp.data["id"]

    # 2. Cliente A puede ver su solicitud; Cliente B recibe lista vacía
    list_a = api.get("/api/v1/service-requests/")
    assert len(list_a.data["results"]) == 1

    api.force_authenticate(user=users["b"])
    list_b = api.get("/api/v1/service-requests/")
    assert len(list_b.data["results"]) == 0

    # 3. Admin lista solicitudes con paginación y filtros
    api.force_authenticate(user=admin)
    admin_list = api.get(f"/api/v1/admin/service-requests/?status=pending&page=1&page_size=10")
    assert admin_list.status_code == 200
    assert admin_list.data["count"] >= 1
    assert any(r["id"] == str(sr_id) for r in admin_list.data["results"])

    # 4. Admin contacta al cliente
    contact_resp = api.patch(
        f"/api/v1/admin/requests/{sr_id}/status/",
        {"status": "contacted", "admin_notes": "Llamada realizada. Enviada propuesta preliminar."},
        format="json"
    )
    assert contact_resp.status_code == 200

    # 5. Admin acepta la solicitud -> Genera Booking automáticamente
    accept_resp = api.patch(
        f"/api/v1/admin/requests/{sr_id}/status/",
        {"status": "accepted", "admin_notes": "Propuesta formal aprobada por cliente."},
        format="json"
    )
    assert accept_resp.status_code == 200

    sr = ServiceRequest.objects.get(id=sr_id)
    assert sr.status == "accepted"

    # Verificar existencia de la reserva confirmada automática
    booking = Booking.objects.filter(user=cliente, service=svc).first()
    assert booking is not None
    assert booking.status == "confirmed"


@pytest.mark.django_db
def test_srv02_booking_cancellation_and_completion_rules(api, users, service_fixtures):
    cliente = users["a"]
    svc = service_fixtures["svc_fixed"]

    # 1. Crear reserva confirmada
    booking = Booking.objects.create(
        user=cliente,
        service=svc,
        scheduled_date=timezone.now() + timezone.timedelta(days=3),
        status=Booking.Status.CONFIRMED,
        notes="Reserva inicial",
    )

    api.force_authenticate(user=cliente)

    # 2. Cliente cancela su reserva
    del_resp = api.delete(f"/api/v1/bookings/{booking.id}/")
    assert del_resp.status_code == 204

    booking.refresh_from_db()
    assert booking.status == Booking.Status.CANCELLED
    assert booking.cancelled_at is not None

    # 3. Reserva completada no puede ser cancelada
    booking_completed = Booking.objects.create(
        user=cliente,
        service=svc,
        scheduled_date=timezone.now() - timezone.timedelta(days=1),
        status=Booking.Status.COMPLETED,
    )
    cannot_del = api.delete(f"/api/v1/bookings/{booking_completed.id}/")
    assert cannot_del.status_code == 400
    assert "No puedes cancelar una reserva completada" in cannot_del.data["detail"]


@pytest.mark.django_db
def test_srv02_fixed_price_service_checkout(api, users, service_fixtures):
    cliente = users["a"]
    svc = service_fixtures["svc_fixed"]

    api.force_authenticate(user=cliente)

    resp = api.post(f"/api/v1/services/{svc.slug}/checkout/")
    assert resp.status_code == 201
    order_id = resp.data["order_id"]

    order = Order.objects.get(id=order_id)
    assert order.user == cliente
    assert order.total == svc.price
    assert order.stock_deductions == {}
