from tests.test_payments_api import CHECKOUT


def test_authenticated_payment_is_visible_to_attendee_and_can_be_cancelled(client) -> None:
    account = client.post(
        "/api/v1/auth/register",
        json={"email": CHECKOUT["attendee"]["email"], "password": "password123", "full_name": "Asha Mwinyi"},
    ).json()
    headers = {"Authorization": f"Bearer {account['access_token']}"}

    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT, headers=headers)
    assert payment.status_code == 201, payment.text
    registration_id = payment.json()["registration_id"]

    response = client.get("/api/v1/attendee/registrations", headers=headers)
    assert response.status_code == 200
    assert response.json()[0]["id"] == registration_id
    assert response.json()[0]["status"] == "pending"

    response = client.delete(f"/api/v1/attendee/registrations/{registration_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    response = client.get(f"/api/v1/attendee/registrations/{registration_id}", headers=headers)
    assert response.json()["status"] == "cancelled"


def test_attendee_cannot_read_another_attendees_registration(client) -> None:
    first = client.post(
        "/api/v1/auth/register",
        json={"email": "first-registration@example.com", "password": "password123", "full_name": "First Person"},
    ).json()
    second = client.post(
        "/api/v1/auth/register",
        json={"email": "second-registration@example.com", "password": "password123", "full_name": "Second Person"},
    ).json()
    payment = client.post(
        "/api/v1/payments/mobile",
        json={**CHECKOUT, "attendee": {"full_name": "First Person", "email": "first-registration@example.com"}},
        headers={"Authorization": f"Bearer {first['access_token']}"},
    ).json()

    response = client.get(
        f"/api/v1/attendee/registrations/{payment['registration_id']}",
        headers={"Authorization": f"Bearer {second['access_token']}"},
    )
    assert response.status_code == 404
