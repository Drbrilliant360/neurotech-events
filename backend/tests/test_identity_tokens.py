from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select

from app.api.deps import identity_notification_provider
from app.db.models import IdentityToken, RefreshToken, User
from app.db.models.enums import UserRole
from app.integrations.messaging import CaptureNotificationProvider

PASSWORD = "password123"


def _register(client, email: str = "identity@example.com") -> dict:
    response = client.post(
        "/api/v1/auth/register", json={"email": email, "password": PASSWORD, "full_name": "Identity Tester"}
    )
    assert response.status_code == 201, response.text
    return response.json()


def _raw(capture: CaptureNotificationProvider, index: int = -1) -> str:
    return parse_qs(urlparse(capture.messages[index].url).query)["token"][0]


def test_verification_tokens_are_hashed_single_use_and_prior_tokens_are_invalidated(client, db) -> None:
    capture = CaptureNotificationProvider()
    client.app.dependency_overrides[identity_notification_provider] = lambda: capture
    _register(client)
    first = _raw(capture)
    client.post("/api/v1/auth/email-verification/request", json={"email": "identity@example.com"})
    second = _raw(capture)
    assert first != second
    records = list(db.scalars(select(IdentityToken)))
    assert all(first not in record.token_hash and second not in record.token_hash for record in records)
    assert client.post("/api/v1/auth/email-verification/confirm", json={"token": first}).status_code == 400
    assert client.post("/api/v1/auth/email-verification/confirm", json={"token": second}).status_code == 200
    assert client.post("/api/v1/auth/email-verification/confirm", json={"token": second}).status_code == 400
    assert db.scalar(select(User).where(User.email == "identity@example.com")).email_verified_at is not None


def test_reset_request_does_not_enumerate_and_reset_revokes_sessions(client, db) -> None:
    capture = CaptureNotificationProvider()
    client.app.dependency_overrides[identity_notification_provider] = lambda: capture
    tokens = _register(client)
    known = client.post("/api/v1/auth/password-reset/request", json={"email": "identity@example.com"})
    unknown = client.post("/api/v1/auth/password-reset/request", json={"email": "missing@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    raw = _raw(capture)
    reset = client.post("/api/v1/auth/password-reset/confirm", json={"token": raw, "new_password": "new-password-123"})
    assert reset.status_code == 200
    assert client.get("/api/v1/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert all(record.revoked_at is not None for record in db.scalars(select(RefreshToken)))
    assert (
        client.post("/api/v1/auth/login", json={"email": "identity@example.com", "password": PASSWORD}).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "identity@example.com", "password": "new-password-123"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/password-reset/confirm", json={"token": raw, "new_password": "another-password"}
        ).status_code
        == 400
    )


def test_expired_reset_token_is_rejected(client, db) -> None:
    capture = CaptureNotificationProvider()
    client.app.dependency_overrides[identity_notification_provider] = lambda: capture
    _register(client)
    client.post("/api/v1/auth/password-reset/request", json={"email": "identity@example.com"})
    raw = _raw(capture)
    record = db.scalar(select(IdentityToken).where(IdentityToken.purpose == "reset_password"))
    record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    assert (
        client.post(
            "/api/v1/auth/password-reset/confirm", json={"token": raw, "new_password": "new-password-123"}
        ).status_code
        == 400
    )


def test_identity_endpoints_have_a_separate_rate_limit(client, test_settings) -> None:
    test_settings.rate_limit_enabled = True
    test_settings.identity_rate_limit_per_minute = 2
    statuses = [
        client.post("/api/v1/auth/password-reset/request", json={"email": f"user{i}@example.com"}).status_code
        for i in range(3)
    ]
    assert statuses == [202, 202, 429]


def test_hardened_login_requires_verification_without_blocking_admin_bootstrap(client, db, test_settings) -> None:
    _register(client)
    test_settings.environment = "production"
    blocked = client.post("/api/v1/auth/login", json={"email": "identity@example.com", "password": PASSWORD})
    assert blocked.status_code == 401
    user = db.scalar(select(User).where(User.email == "identity@example.com"))
    user.role = UserRole.PLATFORM_ADMIN
    db.commit()
    allowed = client.post("/api/v1/auth/login", json={"email": "identity@example.com", "password": PASSWORD})
    assert allowed.status_code == 200
