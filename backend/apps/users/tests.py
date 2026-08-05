# apps/users/tests.py
#
# Cobertura dedicada del módulo de usuarios: registro, unicidad,
# y la protección contra autoescalación de privilegios vía el
# endpoint de perfil (is_staff/is_superuser son read_only, pero se
# confirma empíricamente, no solo leyendo el código — es el mismo
# criterio que se usó en el resto de la auditoría de esta sesión).

from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class RegistrationTest(TestCase):
    def setUp(self):
        cache.clear()  # el throttle de registro comparte cache entre tests
        self.client = APIClient()

    def _payload(self, email="nuevo@test.com", username="nuevo"):
        return {
            "email": email, "username": username,
            "password": "ClaveSegura123!", "password2": "ClaveSegura123!",
        }

    def test_registration_succeeds(self):
        resp = self.client.post("/api/v1/auth/register/", self._payload(), format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(email="nuevo@test.com").exists())

    def test_duplicate_email_returns_clean_400_not_500(self):
        self.client.post("/api/v1/auth/register/", self._payload(username="u1"), format="json")
        resp = self.client.post(
            "/api/v1/auth/register/", self._payload(username="u2"), format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data)

    def test_duplicate_username_returns_clean_400_not_500(self):
        self.client.post(
            "/api/v1/auth/register/",
            self._payload(email="a@test.com", username="mismo"), format="json"
        )
        resp = self.client.post(
            "/api/v1/auth/register/",
            self._payload(email="b@test.com", username="mismo"), format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("username", resp.data)

    def test_mismatched_passwords_rejected(self):
        payload = self._payload()
        payload["password2"] = "OtraClave456!"
        resp = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(User.objects.filter(email=payload["email"]).exists())


class ProfilePrivilegeEscalationTest(TestCase):
    """
    Confirma empíricamente (no solo leyendo el código) que un usuario
    normal no puede autoescalarse a staff/superuser vía PATCH a su
    propio perfil, a pesar de que esos campos figuran en el serializer
    (están marcados read_only, pero se valida el comportamiento real).
    """
    def setUp(self):
        self.user = User.objects.create_user(
            email="normal@test.com", username="normal", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_cannot_set_is_staff_via_profile_patch(self):
        resp = self.client.patch("/api/v1/auth/profile/", {
            "is_staff": True, "first_name": "Cambiado",
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)
        self.assertEqual(self.user.first_name, "Cambiado")  # esto sí se guarda

    def test_cannot_set_is_superuser_via_profile_patch(self):
        resp = self.client.patch("/api/v1/auth/profile/", {
            "is_superuser": True,
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_superuser)

    def test_cannot_change_email_via_profile_patch(self):
        resp = self.client.patch("/api/v1/auth/profile/", {
            "email": "hackeado@test.com",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "normal@test.com")  # no cambió

    def test_can_update_own_regular_fields(self):
        resp = self.client.patch("/api/v1/auth/profile/", {
            "first_name": "Juan", "address_comuna": "Providencia",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Juan")
        self.assertEqual(self.user.address_comuna, "Providencia")

    def test_anonymous_cannot_access_profile(self):
        anon_client = APIClient()
        resp = anon_client.get("/api/v1/auth/profile/")
        self.assertEqual(resp.status_code, 401)


class GoogleAuthTest(TestCase):
    """
    Login con Google — el backend nunca confía en datos que mande el
    cliente directamente, siempre verifica la firma del token contra
    Google antes de crear o loguear a alguien.
    """
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _mock_idinfo(self, **overrides):
        base = {
            "email": "googleuser@test.com",
            "email_verified": True,
            "given_name": "Juan",
            "family_name": "Pérez",
        }
        base.update(overrides)
        return base

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_creates_new_user_on_first_google_login(self, mock_verify):
        mock_verify.return_value = self._mock_idinfo()

        resp = self.client.post("/api/v1/auth/google/", {"credential": "fake-token"}, format="json")

        self.assertEqual(resp.status_code, 200)
        user = User.objects.get(email="googleuser@test.com")
        self.assertEqual(user.first_name, "Juan")
        self.assertFalse(user.has_usable_password())  # no puede loguearse con contraseña
        # Cookies HTTPOnly seteadas, no tokens en el body
        self.assertIn(settings.AUTH_COOKIE_ACCESS, resp.cookies)
        self.assertNotIn("access", resp.data)

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_existing_user_logs_in_without_duplicating(self, mock_verify):
        User.objects.create_user(email="googleuser@test.com", username="ya_existe", password="x")
        mock_verify.return_value = self._mock_idinfo()

        resp = self.client.post("/api/v1/auth/google/", {"credential": "fake-token"}, format="json")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(User.objects.filter(email="googleuser@test.com").count(), 1)

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_invalid_token_rejected(self, mock_verify):
        mock_verify.side_effect = ValueError("token inválido")

        resp = self.client.post("/api/v1/auth/google/", {"credential": "token-trucho"}, format="json")

        self.assertEqual(resp.status_code, 401)
        self.assertFalse(User.objects.filter(email="googleuser@test.com").exists())

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_unverified_email_rejected(self, mock_verify):
        mock_verify.return_value = self._mock_idinfo(email_verified=False)

        resp = self.client.post("/api/v1/auth/google/", {"credential": "fake-token"}, format="json")

        self.assertEqual(resp.status_code, 400)
        self.assertFalse(User.objects.filter(email="googleuser@test.com").exists())

    def test_missing_credential_rejected(self):
        resp = self.client.post("/api/v1/auth/google/", {}, format="json")
        self.assertEqual(resp.status_code, 400)
