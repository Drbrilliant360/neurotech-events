from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select

from app.core.rate_limit import SlidingWindowLimiter
from app.db.models import AuditLog, RefreshToken

PASSWORD = "password123"


def signup(client, email: str = "session@example.com") -> dict:
    response = client.post(
        "/api/v1/auth/register", json={"email": email, "password": PASSWORD, "full_name": "Session Tester"}
    )
    assert response.status_code == 201, response.text
    return response.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_returns_access_and_refresh_tokens(client) -> None:
    signup(client)
    response = client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": PASSWORD})
    assert response.status_code == 200
    body = response.json()
    assert body["refresh_token"] and body["expires_in"] == 30 * 60
    assert client.get("/api/v1/me", headers=bearer(body["access_token"])).status_code == 200


def test_refresh_rotates_and_detects_reuse(client) -> None:
    first = signup(client)
    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert rotated.status_code == 200
    second = rotated.json()
    assert second["refresh_token"] != first["refresh_token"]

    # Replaying the old token revokes the whole family, including the newest token.
    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "invalid_refresh_token"
    after = client.post("/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert after.status_code == 401


def test_expired_refresh_token_is_rejected(client, db) -> None:
    tokens = signup(client)
    for record in db.scalars(select(RefreshToken)):
        record.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 401


def test_logout_revokes_refresh_token(client) -> None:
    tokens = signup(client)
    assert client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    # Unknown tokens are accepted silently so sign-out cannot be used to probe token validity.
    assert client.post("/api/v1/auth/logout", json={"refresh_token": "x" * 40}).status_code == 204


def test_logout_all_invalidates_existing_access_tokens(client) -> None:
    tokens = signup(client)
    headers = bearer(tokens["access_token"])
    assert client.post("/api/v1/auth/logout-all", headers=headers).status_code == 204
    assert client.get("/api/v1/me", headers=headers).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_password_change_requires_current_password_and_revokes_old_sessions(client) -> None:
    tokens = signup(client)
    headers = bearer(tokens["access_token"])
    wrong = client.post(
        "/api/v1/auth/password", json={"current_password": "wrong-password", "new_password": "new-password-1"},
        headers=headers,
    )
    assert wrong.status_code == 403

    changed = client.post(
        "/api/v1/auth/password", json={"current_password": PASSWORD, "new_password": "new-password-1"}, headers=headers
    )
    assert changed.status_code == 200
    assert client.get("/api/v1/me", headers=headers).status_code == 401
    assert client.get("/api/v1/me", headers=bearer(changed.json()["access_token"])).status_code == 200
    old_login = client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": PASSWORD})
    assert old_login.status_code == 401
    new_login = client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": "new-password-1"})
    assert new_login.status_code == 200


def test_tokens_with_wrong_audience_or_type_are_rejected(client, test_settings) -> None:
    body = signup(client)
    claims = jwt.decode(
        body["access_token"], test_settings.jwt_secret_key, algorithms=["HS256"], audience=test_settings.jwt_audience
    )
    for override in ({"aud": "another-service"}, {"typ": "refresh"}):
        forged = jwt.encode({**claims, **override}, test_settings.jwt_secret_key, algorithm="HS256")
        assert client.get("/api/v1/me", headers=bearer(forged)).status_code == 401


def test_login_failures_are_audited_without_passwords(client, db) -> None:
    signup(client)
    client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": "not-the-password"})
    entries = list(db.scalars(select(AuditLog).where(AuditLog.action == "auth.login_failed")))
    assert len(entries) == 1
    assert "not-the-password" not in str(entries[0].details)


def test_login_is_rate_limited_per_account(client, test_settings) -> None:
    signup(client)
    test_settings.rate_limit_enabled = True
    test_settings.auth_rate_limit_per_minute = 3
    statuses = [
        client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": "bad-password"}).status_code
        for _ in range(4)
    ]
    assert statuses == [401, 401, 401, 429]
    blocked = client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": PASSWORD})
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) >= 1


def test_sliding_window_limiter_frees_slots() -> None:
    limiter = SlidingWindowLimiter()
    assert limiter.hit("k", 2, window_seconds=0.05) is None
    assert limiter.hit("k", 2, window_seconds=0.05) is None
    assert limiter.hit("k", 2, window_seconds=0.05) is not None
    import time

    time.sleep(0.06)
    assert limiter.hit("k", 2, window_seconds=0.05) is None
