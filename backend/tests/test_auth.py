def test_register_login_and_current_user(client) -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": "Demo@Example.com",
            "password": "ChangeMe123!",
            "full_name": "Demo Attendee",
            "profile": {"organization": "Neurotech Africa", "interests": ["BCI", "AI"]},
        },
    )
    assert registration.status_code == 201
    token = registration.json()["access_token"]

    duplicate = client.post(
        "/api/v1/auth/register",
        json={"email": "demo@example.com", "password": "ChangeMe123!", "full_name": "Demo Attendee"},
    )
    assert duplicate.status_code == 409

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@example.com", "password": "ChangeMe123!"},
    )
    assert login.status_code == 200

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "demo@example.com"
    assert me.json()["profile"]["organization"] == "Neurotech Africa"

    update = client.patch(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "Updated Attendee", "job_title": "Researcher"},
    )
    assert update.status_code == 200
    assert update.json()["full_name"] == "Updated Attendee"
    assert update.json()["profile"]["job_title"] == "Researcher"


def test_invalid_login_is_rejected(client) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "ChangeMe123!", "full_name": "User"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
